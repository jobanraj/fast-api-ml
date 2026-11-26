# DevDocs Copilot

An agentic RAG assistant that answers **React and JavaScript** questions from documentation you upload.
Built with React (Vite) on the front end and Node.js + Express + LangGraph.js on the back end.

## How the agent decides

```
Question
  -> condenseQuestion   (turns follow-ups into standalone questions)
  -> detectTopic        (react | javascript | both | offtopic)
       offtopic -> polite decline
  -> searchUploadedDocs (your uploaded docs, filtered by topic)
  -> judgeDocs
       enough     -> answerFromDocs  (explanation + code example + sources)
       not enough -> searchOfficialSites (react.dev, MDN, javascript.info via Tavily)
                       -> judgeWeb
                            enough     -> answerFromWeb
                            not enough -> rewriteQuery -> back to searchUploadedDocs (once)
                                          still weak   -> admitNoEvidence
```

Every answer shows its source badge, citations, and the full decision trace.

## Run it

Requires Node 18+ and an OpenAI API key. A Tavily key is optional (enables the official-sites fallback).

```bash
npm install                 # installs concurrently at the root
npm run install:all         # installs server + client
cp server/.env.example server/.env   # then add your keys
npm run seed                # indexes the two starter notes in server/starter-docs
npm run seed:official       # optional: indexes official React + MDN pages by URL
npm run dev                 # API on :8000, React app on http://localhost:5173
```

## Add your own docs

In the left panel, upload a file (.pdf, .md, .mdx, .txt, .docx, .html, .js, .jsx) or paste a documentation URL.
Tag it React, JavaScript, or both so retrieval can filter by topic. Removing a doc deletes its passages.

## Project layout

```
server/
  src/agent/graph.js            LangGraph workflow (all agent nodes and routing)
  src/agent/schemas.js          Zod schemas for topic and evidence verdicts
  src/knowledge/vectorIndex.js  File-backed vector index (no external DB)
  src/knowledge/docLoader.js    File/URL -> text -> chunks -> index
  src/routes/api.js             /api/chat, /api/docs, /api/docs/upload, /api/docs/url
  scripts/seedDocs.js           Seeds starter notes or official URLs
  starter-docs/                 Starter notes + official URL list
client/
  src/App.jsx                   Layout and docs state
  src/components/               DocsLibrary, ChatPanel, MessageBubble, DecisionTrace
  src/apiClient.js              fetch helpers
```

## Notes

- The index is stored in `server/data/docs-index.json`. For large doc sets, swap `vectorIndex.js` for Pinecone, Qdrant, or pgvector; the rest of the code only uses `addChunks`, `searchChunks`, `listSources`, and `removeSource`.
- There is no login. Run it locally, or add authentication before exposing the upload endpoints.
- `npm --prefix client run build` creates `client/dist`, which the server serves automatically.
