import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  port: Number(process.env.PORT || 8000),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
  chatModel: process.env.CHAT_MODEL || "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  resultsPerSearch: 4,
  maxQueryRewrites: 1,
  officialSites: ["react.dev", "developer.mozilla.org", "javascript.info"],
  serverRoot,
  dataDir: path.join(serverRoot, "data"),
  uploadDir: path.join(serverRoot, "uploads"),
  indexFile: path.join(serverRoot, "data", "docs-index.json"),
  starterDocsDir: path.join(serverRoot, "starter-docs"),
};
