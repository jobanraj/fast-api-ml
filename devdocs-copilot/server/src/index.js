import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { apiRouter } from "./routes/api.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRouter);

// Serve the built React app when it exists (npm run build in client/).
const clientDist = path.resolve(config.serverRoot, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use((error, _req, res, _next) => {
  const status = error.name === "ZodError" ? 400 : 500;
  res.status(status).json({ error: error.message });
});

app.listen(config.port, () => console.log(`DevDocs Copilot API on http://localhost:${config.port}`));
