import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config.js";
import { indexDocument, readFileAsText, readUrlAsText } from "../src/knowledge/docLoader.js";

const useOfficial = process.argv.includes("--official");

if (useOfficial) {
  const entries = JSON.parse(await fs.readFile(path.join(config.starterDocsDir, "official-urls.json"), "utf8"));
  for (const { url, topic } of entries) {
    try {
      const chunks = await indexDocument({ text: await readUrlAsText(url), source: url, topic });
      console.log(`Indexed ${url} -> ${chunks} chunks`);
    } catch (error) {
      console.warn(`Skipped ${url}: ${error.message}`);
    }
  }
} else {
  const files = (await fs.readdir(config.starterDocsDir)).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const topic = file.startsWith("react-") ? "react" : file.startsWith("js-") ? "javascript" : "both";
    const text = await readFileAsText(path.join(config.starterDocsDir, file));
    const chunks = await indexDocument({ text, source: file, topic });
    console.log(`Indexed ${file} -> ${chunks} chunks`);
  }
}
