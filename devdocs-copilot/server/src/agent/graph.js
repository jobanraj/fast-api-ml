import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tavily } from "@tavily/core";
import { config } from "../config.js";
import { searchChunks } from "../knowledge/vectorIndex.js";
import { topicSchema, verdictSchema } from "./schemas.js";

let chatModel = null;
function getModel() {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is missing in server/.env");
  chatModel ??= new ChatOpenAI({ model: config.chatModel, temperature: 0, apiKey: config.openaiApiKey });
  return chatModel;
}

const AgentState = Annotation.Root({
  question: Annotation(),
  history: Annotation(),
  searchQuery: Annotation(),
  topic: Annotation(),
  docChunks: Annotation(),
  webEvidence: Annotation(),
  webLinks: Annotation(),
  rewrites: Annotation(),
  verdict: Annotation(),
  answer: Annotation(),
  sourceUsed: Annotation(),
  citations: Annotation(),
  trace: Annotation({ reducer: (current, update) => current.concat(update), default: () => [] }),
});

const formatHistory = (history = []) =>
  history.slice(-6).map((m) => `${m.role === "user" ? "Developer" : "Assistant"}: ${m.content}`).join("\n");

const formatChunks = (chunks) =>
  chunks.map((c, i) => `[Doc ${i + 1}: ${c.metadata.source}]\n${c.text}`).join("\n\n");

// ---- nodes ----------------------------------------------------------------

async function condenseQuestion(state) {
  if (!state.history?.length) return { searchQuery: state.question, trace: ["Question is standalone"] };
  const result = await getModel().invoke(
    `Rewrite the developer's last message as one standalone question about React or JavaScript.
Keep technical terms and code identifiers exactly. Return only the question.

Conversation:
${formatHistory(state.history)}

Last message: ${state.question}`
  );
  const standalone = String(result.content).trim();
  return { searchQuery: standalone, trace: [`Follow-up resolved: "${standalone}"`] };
}

async function detectTopic(state) {
  const { topic } = await getModel()
    .withStructuredOutput(topicSchema)
    .invoke(`Classify this developer question.\nQuestion: ${state.searchQuery}`);
  return { topic, trace: [`Topic detected: ${topic}`] };
}

const afterTopic = (state) => (state.topic === "offtopic" ? "declineOffTopic" : "searchUploadedDocs");

async function searchUploadedDocs(state) {
  const docChunks = await searchChunks(state.searchQuery, { topic: state.topic });
  return { docChunks, trace: [`Searched your docs: ${docChunks.length} passages`] };
}

async function judgeDocs(state) {
  if (!state.docChunks.length) return { verdict: "not_enough", trace: ["Your docs have nothing relevant"] };
  const { verdict } = await getModel()
    .withStructuredOutput(verdictSchema)
    .invoke(`Question: ${state.searchQuery}

Documentation passages:
${formatChunks(state.docChunks)}

Say "enough" only if these passages contain what is needed to answer specifically and correctly.`);
  return { verdict, trace: [`Docs judged: ${verdict}`] };
}

const afterDocJudgement = (state) => (state.verdict === "enough" ? "answerFromDocs" : "searchOfficialSites");

async function searchOfficialSites(state) {
  if (!config.tavilyApiKey) {
    return { webEvidence: "", webLinks: [], trace: ["Official-site search skipped (no TAVILY_API_KEY)"] };
  }
  const client = tavily({ apiKey: config.tavilyApiKey });
  const result = await client.search(state.searchQuery, {
    maxResults: 5,
    includeAnswer: true,
    includeDomains: config.officialSites,
  });
  const blocks = result.results.map((r) => `Title: ${r.title}\nURL: ${r.url}\n${r.content}`);
  return {
    webEvidence: blocks.join("\n\n"),
    webLinks: result.results.map((r) => ({ title: r.title, url: r.url })),
    trace: [`Searched ${config.officialSites.join(", ")}: ${result.results.length} pages`],
  };
}

async function judgeWeb(state) {
  if (!state.webEvidence) return { verdict: "not_enough", trace: ["No web evidence to judge"] };
  const { verdict } = await getModel()
    .withStructuredOutput(verdictSchema)
    .invoke(`Question: ${state.searchQuery}\n\nWeb evidence:\n${state.webEvidence}\n\nIs this enough to answer correctly?`);
  return { verdict, trace: [`Web evidence judged: ${verdict}`] };
}

function afterWebJudgement(state) {
  if (state.verdict === "enough") return "answerFromWeb";
  return state.rewrites < config.maxQueryRewrites ? "rewriteQuery" : "admitNoEvidence";
}

async function rewriteQuery(state) {
  const result = await getModel().invoke(
    `Rewrite this React/JavaScript question as a better documentation search query.
Use the official API names (hook names, MDN method names). Return only the query.
Question: ${state.searchQuery}`
  );
  const searchQuery = String(result.content).trim();
  return { searchQuery, rewrites: state.rewrites + 1, trace: [`Query rewritten: "${searchQuery}"`] };
}

const ANSWER_RULES = `You are a senior React and JavaScript mentor.
Rules:
- Use ONLY the evidence provided. If something is not covered, say so plainly.
- Explain the idea in a few sentences, then show a short, complete code example in a fenced block (use \`\`\`jsx for React, \`\`\`js for JavaScript).
- Mention common mistakes when the evidence supports it.
- Keep it concise and practical.`;

async function answerFromDocs(state) {
  const result = await getModel().invoke(
    `${ANSWER_RULES}\n\nQuestion: ${state.question}\n\nYour uploaded documentation:\n${formatChunks(state.docChunks)}`
  );
  const seen = new Set();
  const citations = [];
  for (const chunk of state.docChunks) {
    if (seen.has(chunk.metadata.source)) continue;
    seen.add(chunk.metadata.source);
    const isUrl = /^https?:\/\//.test(chunk.metadata.source);
    citations.push({ title: chunk.metadata.source, url: isUrl ? chunk.metadata.source : "", kind: "uploaded" });
  }
  return { answer: String(result.content), sourceUsed: "uploaded_docs", citations, trace: ["Answered from your docs"] };
}

async function answerFromWeb(state) {
  const result = await getModel().invoke(
    `${ANSWER_RULES}\n- Say the answer comes from official documentation sites, not the user's uploaded docs.\n\nQuestion: ${state.question}\n\nEvidence:\n${state.webEvidence}`
  );
  const citations = state.webLinks.map((l) => ({ ...l, kind: "official" }));
  return { answer: String(result.content), sourceUsed: "official_sites", citations, trace: ["Answered from official sites"] };
}

function declineOffTopic() {
  return {
    answer: "I only answer React and JavaScript questions. Try asking about hooks, components, async code, the DOM, or modules.",
    sourceUsed: "off_topic",
    citations: [],
    trace: ["Declined: not a React or JavaScript question"],
  };
}

function admitNoEvidence() {
  return {
    answer: "I couldn't find this in your uploaded docs or on the official sites. Upload the relevant documentation page, or rephrase the question with the API name you're using.",
    sourceUsed: "no_evidence",
    citations: [],
    trace: ["Stopped: no reliable evidence found"],
  };
}

// ---- graph ----------------------------------------------------------------

const graph = new StateGraph(AgentState)
  .addNode("condenseQuestion", condenseQuestion)
  .addNode("detectTopic", detectTopic)
  .addNode("searchUploadedDocs", searchUploadedDocs)
  .addNode("judgeDocs", judgeDocs)
  .addNode("searchOfficialSites", searchOfficialSites)
  .addNode("judgeWeb", judgeWeb)
  .addNode("rewriteQuery", rewriteQuery)
  .addNode("answerFromDocs", answerFromDocs)
  .addNode("answerFromWeb", answerFromWeb)
  .addNode("declineOffTopic", declineOffTopic)
  .addNode("admitNoEvidence", admitNoEvidence)
  .addEdge(START, "condenseQuestion")
  .addEdge("condenseQuestion", "detectTopic")
  .addConditionalEdges("detectTopic", afterTopic, ["declineOffTopic", "searchUploadedDocs"])
  .addEdge("searchUploadedDocs", "judgeDocs")
  .addConditionalEdges("judgeDocs", afterDocJudgement, ["answerFromDocs", "searchOfficialSites"])
  .addEdge("searchOfficialSites", "judgeWeb")
  .addConditionalEdges("judgeWeb", afterWebJudgement, ["answerFromWeb", "rewriteQuery", "admitNoEvidence"])
  .addEdge("rewriteQuery", "searchUploadedDocs")
  .addEdge("answerFromDocs", END)
  .addEdge("answerFromWeb", END)
  .addEdge("declineOffTopic", END)
  .addEdge("admitNoEvidence", END)
  .compile();

export async function askAgent(question, history = []) {
  const result = await graph.invoke({
    question,
    history,
    searchQuery: question,
    topic: "",
    docChunks: [],
    webEvidence: "",
    webLinks: [],
    rewrites: 0,
    verdict: "",
    answer: "",
    sourceUsed: "",
    citations: [],
  });
  return {
    answer: result.answer,
    sourceUsed: result.sourceUsed,
    topic: result.topic,
    citations: result.citations,
    trace: result.trace,
    searchQuery: result.searchQuery,
  };
}
