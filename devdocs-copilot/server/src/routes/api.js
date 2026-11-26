import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { askAgent } from "../agent/graph.js";
import { listSources, removeSource } from "../knowledge/vectorIndex.js";
import { indexDocument, readFileAsText, readUrlAsText, SUPPORTED_EXTENSIONS } from "../knowledge/docLoader.js";

const upload = multer({ dest: config.uploadDir, limits: { fileSize: 15 * 1024 * 1024 } });
export const apiRouter = Router();

const topicField = z.enum(["react", "javascript", "both"]).default("both");
const chatBody = z.object({
  question: z.string().min(2).max(3000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(20).default([]),
});

const handle = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    console.error(error);
    const status = error.status || (error.name === "ZodError" ? 400 : 500);
    res.status(status).json({ error: error.message });
  });

apiRouter.get("/health", (_req, res) => res.json({ ok: true, hasTavily: Boolean(config.tavilyApiKey) }));

apiRouter.post("/chat", handle(async (req, res) => {
  const { question, history } = chatBody.parse(req.body);
  res.json(await askAgent(question, history));
}));

apiRouter.get("/docs", handle(async (_req, res) => res.json(await listSources())));

apiRouter.delete("/docs", handle(async (req, res) => {
  res.json({ removed: await removeSource(String(req.query.source || "")) });
}));

apiRouter.post("/docs/upload", upload.single("file"), handle(async (req, res) => {
  if (!req.file) throw Object.assign(new Error("No file received"), { status: 400 });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const tempPath = req.file.path + ext;
  try {
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      throw Object.assign(new Error(`Supported types: ${[...SUPPORTED_EXTENSIONS].join(", ")}`), { status: 400 });
    }
    const topic = topicField.parse(req.body.topic || undefined);
    await fs.rename(req.file.path, tempPath);
    const text = await readFileAsText(tempPath);
    const chunks = await indexDocument({ text, source: req.file.originalname, topic });
    res.json({ source: req.file.originalname, chunks });
  } finally {
    await fs.rm(req.file.path, { force: true });
    await fs.rm(tempPath, { force: true });
  }
}));

apiRouter.post("/docs/url", handle(async (req, res) => {
  const { url, topic } = z.object({ url: z.string().url(), topic: topicField }).parse(req.body);
  const chunks = await indexDocument({ text: await readUrlAsText(url), source: url, topic });
  res.json({ source: url, chunks });
}));
