// src/worker.js
self.onmessage = (e) => {
  // Worker empfängt Daten
  console.log("Worker emfaengt was");

  const { msg } = e.data;
  // Antwort zurück an Mainthread
  self.postMessage({ reply: `Worker hat empfangen: ${msg}` });
};