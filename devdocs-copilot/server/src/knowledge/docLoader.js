import fs from "node:fs/promises";
import path from "node:path";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import * as cheerio from "cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { addChunks, removeSource } from "./vectorIndex.js";

export const SUPPORTED_EXTENSIONS = new Set([".pdf", ".md", ".mdx", ".txt", ".docx", ".html", ".js", ".jsx"]);

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 150 });

function htmlToText(html) {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, aside, noscript").remove();
  const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");
  return root.text().replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

export async function readFileAsText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) throw new Error(`Unsupported file type: ${ext}`);
  if (ext === ".pdf") return (await pdf(await fs.readFile(filePath))).text;
  if (ext === ".docx") return (await mammoth.extractRawText({ path: filePath })).value;
  const raw = await fs.readFile(filePath, "utf8");
  return ext === ".html" ? htmlToText(raw) : raw;
}

export async function readUrlAsText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "devdocs-copilot/1.0" } });
  if (!response.ok) throw new Error(`Could not fetch ${url} (${response.status})`);
  return htmlToText(await response.text());
}

// Replaces any earlier version of the same source, then embeds and stores the chunks.
export async function indexDocument({ text, source, topic }) {
  if (!text.trim()) throw new Error("The document has no readable text");
  const pieces = await splitter.splitText(text);
  await removeSource(source);
  return addChunks(pieces.map((piece) => ({ text: piece, metadata: { source, topic } })));
}
