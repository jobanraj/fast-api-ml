import { useEffect, useRef, useState } from "react";
import { askQuestion } from "../apiClient.js";
import MessageBubble from "./MessageBubble.jsx";

const EXAMPLES = [
  "Why does my useEffect run in an infinite loop?",
  "How do I run several fetch calls in parallel?",
  "When should I use useMemo?",
  "What is a closure? Show an example.",
];

export default function ChatPanel({ hasDocs }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const question = text.trim();
    if (!question || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const result = await askQuestion(question, history);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer, meta: result }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: error.message, failed: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <h2>Ask a React or JavaScript question</h2>
            <p className="muted">
              {hasDocs ? "I'll search your docs first, then official sites." : "Add documentation on the left, or ask and I'll check official sites if search is enabled."}
            </p>
            <div className="examples">
              {EXAMPLES.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && <p className="muted thinking">Searching the docs…</p>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <textarea
          rows={2}
          value={input}
          placeholder="Ask about hooks, components, promises, the DOM…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="primary" disabled={loading || input.trim().length < 2} onClick={() => send(input)}>
          Ask
        </button>
      </div>
    </main>
  );
}
