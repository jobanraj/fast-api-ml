import ReactMarkdown from "react-markdown";
import DecisionTrace from "./DecisionTrace.jsx";

const SOURCE_LABELS = {
  uploaded_docs: "From your docs",
  official_sites: "From official sites",
  no_evidence: "No evidence found",
  off_topic: "Off topic",
};

export default function MessageBubble({ message }) {
  const { role, content, meta, failed } = message;
  return (
    <article className={`bubble ${role} ${failed ? "failed" : ""}`}>
      {role === "assistant" && meta && (
        <div className="badges">
          <span className={`badge ${meta.sourceUsed}`}>{SOURCE_LABELS[meta.sourceUsed] ?? meta.sourceUsed}</span>
          {meta.topic && meta.topic !== "offtopic" && <span className={`badge topic ${meta.topic}`}>{meta.topic}</span>}
        </div>
      )}
      <div className="markdown">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      {meta?.citations?.length > 0 && (
        <ul className="citations">
          {meta.citations.map((c) => (
            <li key={c.title + c.url}>
              {c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a> : <span>{c.title}</span>}
            </li>
          ))}
        </ul>
      )}
      {meta?.trace && <DecisionTrace steps={meta.trace} />}
    </article>
  );
}
