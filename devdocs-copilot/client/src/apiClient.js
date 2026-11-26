async function request(path, options) {
  const response = await fetch(`/api${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export const askQuestion = (question, history) =>
  request("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });

export const fetchDocs = () => request("/docs");

export const removeDoc = (source) => request(`/docs?source=${encodeURIComponent(source)}`, { method: "DELETE" });

export const uploadDoc = (file, topic) => {
  const form = new FormData();
  form.append("file", file);
  form.append("topic", topic);
  return request("/docs/upload", { method: "POST", body: form });
};

export const addDocUrl = (url, topic) =>
  request("/docs/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, topic }),
  });
