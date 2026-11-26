import { useRef, useState } from "react";
import { addDocUrl, removeDoc, uploadDoc } from "../apiClient.js";

const TOPICS = [
  { value: "both", label: "React + JS" },
  { value: "react", label: "React" },
  { value: "javascript", label: "JavaScript" },
];

export default function DocsLibrary({ docs, error, onChanged }) {
  const [topic, setTopic] = useState("both");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef(null);

  async function run(task, successText) {
    setBusy(true);
    setMessage("");
    try {
      const result = await task();
      setMessage(successText(result));
      await onChanged();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) run(() => uploadDoc(file, topic), (r) => `Indexed ${r.source} (${r.chunks} passages)`);
  };

  const handleUrl = (event) => {
    event.preventDefault();
    if (!url.trim()) return;
    run(() => addDocUrl(url.trim(), topic), (r) => `Indexed ${r.source} (${r.chunks} passages)`).then(() => setUrl(""));
  };

  return (
    <aside className="library">
      <h1 className="brand">DevDocs Copilot</h1>
      <p className="muted">Answers come from the documentation you add here.</p>

      <div className="field">
        <label htmlFor="topic">Docs are about</label>
        <select id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <input ref={fileInput} type="file" hidden onChange={handleFile} accept=".pdf,.md,.mdx,.txt,.docx,.html,.js,.jsx" />
      <button className="primary" disabled={busy} onClick={() => fileInput.current.click()}>
        {busy ? "Indexing…" : "Upload a document"}
      </button>

      <form className="url-form" onSubmit={handleUrl}>
        <input
          type="url"
          placeholder="https://react.dev/reference/react/useState"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Documentation page URL"
        />
        <button disabled={busy || !url.trim()}>Add page</button>
      </form>

      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="notice error">{error}</p>}

      <h2>Your docs ({docs.length})</h2>
      {docs.length === 0 && <p className="muted">Nothing yet. Upload a file or paste a docs URL to start.</p>}
      <ul className="doc-list">
        {docs.map((doc) => (
          <li key={doc.source}>
            <span className={`dot ${doc.topic}`} title={doc.topic} />
            <span className="doc-name" title={doc.source}>{doc.source.replace(/^https?:\/\//, "")}</span>
            <button className="ghost" aria-label={`Remove ${doc.source}`} onClick={() => run(() => removeDoc(doc.source), () => "Removed")}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
