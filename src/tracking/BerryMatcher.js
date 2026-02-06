export class Berries {
  constructor() {
    this.items = [];   // { id, embedding, lastFrame, bbox }
    this.nextId = 1;
  }

  resetFrame() {
    // optional: hier kannst du pro Frame housekeeping machen
  }

  _createNewBerry(det, embedding, frameIndex) {
    const id = this.nextId++;
      console.log("createNewBerry embedding:", embedding);

    // embedding MUSS ein Float32Array sein
    const emb = embedding instanceof Float32Array
      ? embedding.slice()
      : Array.from(embedding); // fallback

    this.items.push({
      id,
      embedding: emb,
      lastFrame: frameIndex,
      bbox: det.bbox,
      age: 1,
      hits: 1,
      misses: 0
    });

    return id;
  }

  match(det, embedding, frameIndex, imgW, imgH) {
    console.log("match() embedding:", embedding);
    if (!embedding) {
      const id = this._createNewBerry(det, embedding, frameIndex);
      return { id, similarity: null, isNew: true };
    }

    let bestId = null;
    let bestSim = -1;

    for (const berry of this.items) {
      const sim = cosineSimilarity(embedding, berry.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestId = berry.id;
      }
    }

    const SIM_THRESHOLD = 0.70;

    if (bestSim < SIM_THRESHOLD) {
      const id = this._createNewBerry(det, embedding, frameIndex);
      return { id, similarity: bestSim, isNew: true };
    }

    // Update existing
    const berry = this.items.find(b => b.id === bestId);

    const ALPHA = 0.2;
    for (let i = 0; i < berry.embedding.length; i++) {
      berry.embedding[i] =
        ALPHA * embedding[i] + (1 - ALPHA) * berry.embedding[i];
    }

    berry.lastFrame = frameIndex;
    berry.bbox = det.bbox;

    return { id: bestId, similarity: bestSim, isNew: false };
  }
}



function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export function countBerriesByClass(berries) {
  const classMap = new Map();
  let total = 0;

  for (const berry of berries.items) {
    const idx = berry.class_idx;
    classMap.set(idx, (classMap.get(idx) || 0) + 1);
    total++;
  }

  return {
    classMap,
    total,
  };
}

export function countBerryArrayByClass(bboxResults) {
  const classMap = new Map();
  let total = 0;

  for (const berry of bboxResults) {
    const idx = berry.class_idx;
    classMap.set(idx, (classMap.get(idx) || 0) + 1);
    total++;
  }

  return {
    classMap,
    total,
  };
}
