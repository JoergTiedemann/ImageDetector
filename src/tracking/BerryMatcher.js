import { SimpleKalman } from "./SimpleKalman";

export class BerryMatcher {
  constructor() {
    this.items = [];
    this.nextId = 1;
    this.usedIds = new Set(); // Frame-lokale Sperre
  }

  // Am Anfang jedes Frames aufrufen
  resetFrame() {
    this.usedIds.clear();
  }

  match(detection, embedding, frameIndex, imageWidth, imageHeight) {
    const maxEmbDist = 0.4;
    const maxPosDist = 0.2;
    const diag = Math.hypot(imageWidth, imageHeight);

    let best = null;
    let bestScore = Infinity;
    let minEDist = Infinity;
    let pDist = Infinity; 
// debugEmbeddingASCII(embedding);
// debugEmbeddingStats(embedding);


    for (const berry of this.items) {
      // Nur gleiche Klasse prüfen
      if (berry.class_idx !== detection.class_idx) continue;

      // ID darf in diesem Frame nicht schon vergeben sein
      if (this.usedIds.has(berry.id)) continue;

      // Embedding-Distanz gegen alle gespeicherten Embeddings dieser Beere
      minEDist = Infinity;
      for (const emb of berry.embeddings) {
        const eDist = embeddingDistance(
          sanitizeEmbedding(embedding),
          sanitizeEmbedding(emb)
        );

// debugCompareEmbeddings(emb, embedding);


        // console.log("Comparing embedding BerryID:", berry.id," length:", berry.embeddings, " embedding:",embedding," emb:",emb," eDist:", eDist);
        if (Number.isFinite(eDist)) {
          minEDist = Math.min(minEDist, eDist);
        }
      }

      // Positions-Distanz
      pDist = bboxDistance(detection.bbox, berry.lastBBox) / diag;

      if (!Number.isFinite(minEDist) || !Number.isFinite(pDist)) continue;
      if (minEDist > maxEmbDist) continue;
      if (pDist > maxPosDist) continue;

      const score = minEDist + pDist;
      if (score < bestScore) {
        bestScore = score;
        best = berry;
      }
    }

    if (best) {
      // bestehende Beere → aktualisieren
      best.embeddings.push(sanitizeEmbedding(embedding));
      best.lastBBox = detection.bbox;
      best.lastSeenFrame = frameIndex;
      best.seenCount += 1;
      best.eDist = minEDist
      best.pDist = pDist;
      best.class_idx = detection.class_idx;
      best.kf.update({
        x: detection.bbox[0],
        y: detection.bbox[1],
        w: detection.bbox[2],
        h: detection.bbox[3]
      });
      console.log("Matched BerryID:", best.id, " eDist:", best.eDist," embeddinglength:", best.embeddings.length);
      this.usedIds.add(best.id); // ID für diesen Frame sperren
      return {
        id: best.id,
        eDist: best.eDist,
        pDist: best.pDist
      };
    } else {
      // neue Beere → neue ID vergeben
      const id = this.nextId++;
      const newBerry = {
        id,
        embeddings: [sanitizeEmbedding(embedding)],
        lastBBox: detection.bbox,
        lastSeenFrame: frameIndex,
        seenCount: 1,
        eDist: -1,
        pDist: -1,
        class_idx: detection.class_idx,
        kf: new SimpleKalman(
          detection.bbox[0],
          detection.bbox[1],
          detection.bbox[2],
          detection.bbox[3]
        )
      };
      // console.log("New BerryID:", id, " eDist:", newBerry.eDist, " seenCount:", newBerry.seenCount);
      this.items.push(newBerry);
      this.usedIds.add(id); // ID für diesen Frame sperren
      return {
        id: id,
        eDist: newBerry.eDist,
        pDist: newBerry.pDist
      };
    }
  }
}

// Hilfsfunktionen bleiben gleich
function sanitizeEmbedding(embedding) {
  return Array.from(embedding).map(v => (Number.isFinite(v) ? v : 0));
}

export function embeddingDistance(a, b) {
  let dot = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];

    // NaN-Schutz
    if (!Number.isFinite(av) || !Number.isFinite(bv)) continue;

    dot += av * bv;
  }

  // Cosine Distance = 1 - cos(angle)
  const dist = 1 - dot;

  // Clamp für numerische Stabilität
  return Math.min(Math.max(dist, 0), 2);
}

export function debugEmbeddingASCII(emb) {
  const chars = " .:-=+*#%@"; // 10 Stufen
  let out = "";

  for (let i = 0; i < emb.length; i++) {
    const v = emb[i];
    const idx = Math.min(
      chars.length - 1,
      Math.floor(Math.abs(v) * (chars.length - 1))
    );
    out += chars[idx];

    if ((i + 1) % 32 === 0) out += "\n"; // 32 Werte pro Zeile
  }

  console.log("Embedding ASCII:\n" + out);
}

export function debugCompareEmbeddings(a, b) {
  console.log("Embedding Distance:", embeddingDistance(a, b));

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff += Math.abs(a[i] - b[i]);
  }

  console.log("L1 difference:", diff.toFixed(4));
}


export function debugEmbeddingStats(emb) {
  let min = Infinity, max = -Infinity, sum = 0, sum2 = 0;

  for (const v of emb) {
    if (!Number.isFinite(v)) {
      console.warn("NaN detected in embedding!");
      continue;
    }
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
    sum2 += v * v;
  }

  const mean = sum / emb.length;
  const variance = sum2 / emb.length - mean * mean;

  console.log("Embedding Stats:", {
    min,
    max,
    mean,
    variance
  });
}


function bboxDistance(detBBox, refBBox) {
  const [ax, ay, aw, ah] = detBBox;
  const [bx, by, bw, bh] = refBBox;
  const ca = { cx: ax + aw / 2, cy: ay + ah / 2 };
  const cb = { cx: bx + bw / 2, cy: by + bh / 2 };
  const dx = ca.cx - cb.cx;
  const dy = ca.cy - cb.cy;
  return Math.sqrt(dx * dx + dy * dy);
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
