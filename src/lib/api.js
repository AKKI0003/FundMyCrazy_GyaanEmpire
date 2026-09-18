async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function generateTopicTree({ subject, text, imageBase64, imageMimeType }) {
  return post("/api/generate-tree", { subject, text, imageBase64, imageMimeType });
}

export function generateQuiz({ subject, topicName }) {
  return post("/api/generate-quiz", { subject, topicName });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
