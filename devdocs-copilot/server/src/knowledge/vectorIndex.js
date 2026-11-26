import fs from "node:fs/promises";
import crypto from "node:crypto";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../config.js";

// A small file-backed vector index: no external database needed.
let embedder = null;
let entries = null;

function getEmbedder() {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is missing in server/.env");
  embedder ??= new OpenAIEmbeddings({ model: config.embeddingModel, apiKey: config.openaiApiKey });
  return embedder;
}

async function loadEntries() {
  if (entries) return entries;
  try {
    entries = JSON.parse(await fs.readFile(config.indexFile, "utf8"));
  } catch {
    entries = [];
  }
  return entries;
}

async function persist() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.writeFile(config.indexFile, JSON.stringify(entries));
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export async function addChunks(chunks) {
  await loadEntries();
  const vectors = await getEmbedder().embedDocuments(chunks.map((c) => c.text));
  chunks.forEach((chunk, i) => {
    entries.push({ id: crypto.randomUUID(), text: chunk.text, metadata: chunk.metadata, vector: vectors[i] });
  });
  await persist();
  return chunks.length;
}

export async function searchChunks(query, { topic = "both", limit = config.resultsPerSearch } = {}) {
  await loadEntries();
  if (entries.length === 0) return [];
  const queryVector = await getEmbedder().embedQuery(query);
  return entries
    .filter((e) => topic === "both" || e.metadata.topic === "both" || e.metadata.topic === topic)
    .map((e) => ({ text: e.text, metadata: e.metadata, score: cosineSimilarity(queryVector, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function listSources() {
  await loadEntries();
  const bySource = new Map();
  for (const e of entries) {
    const row = bySource.get(e.metadata.source) ?? { source: e.metadata.source, topic: e.metadata.topic, chunks: 0 };
    row.chunks += 1;
    bySource.set(e.metadata.source, row);
  }
  return [...bySource.values()];
}

export async function removeSource(source) {
  await loadEntries();
  const before = entries.length;
  entries = entries.filter((e) => e.metadata.source !== source);
  await persist();
  return before - entries.length;
}
