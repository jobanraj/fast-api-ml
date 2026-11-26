import { useCallback, useEffect, useState } from "react";
import { fetchDocs } from "./apiClient.js";
import DocsLibrary from "./components/DocsLibrary.jsx";
import ChatPanel from "./components/ChatPanel.jsx";

export default function App() {
  const [docs, setDocs] = useState([]);
  const [docsError, setDocsError] = useState("");

  const refreshDocs = useCallback(async () => {
    try {
      setDocs(await fetchDocs());
      setDocsError("");
    } catch (error) {
      setDocsError(error.message);
    }
  }, []);

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  return (
    <div className="shell">
      <DocsLibrary docs={docs} error={docsError} onChanged={refreshDocs} />
      <ChatPanel hasDocs={docs.length > 0} />
    </div>
  );
}
