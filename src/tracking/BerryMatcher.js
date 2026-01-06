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

    for (const berry of this.items) {
      // Nur gleiche Klasse prüfen
      if (berry.class_idx !== detection.class_idx) continue;

      // ID darf in diesem Frame nicht schon vergeben sein
      if (this.usedIds.has(berry.id)) continue;

      // Embedding-Distanz gegen alle gespeicherten Embeddings dieser Beere
      let minEDist = Infinity;
      for (const emb of berry.embeddings) {
        const eDist = embeddingDistance(
          sanitizeEmbedding(embedding),
          sanitizeEmbedding(emb)
        );
        if (Number.isFinite(eDist)) {
          minEDist = Math.min(minEDist, eDist);
        }
      }

      // Positions-Distanz
      const pDist = bboxDistance(detection.bbox, berry.lastBBox) / diag;

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
      best.class_idx = detection.class_idx;
      best.kf.update({
        x: detection.bbox[0],
        y: detection.bbox[1],
        w: detection.bbox[2],
        h: detection.bbox[3]
      });
      this.usedIds.add(best.id); // ID für diesen Frame sperren
      return best.id;
    } else {
      // neue Beere → neue ID vergeben
      const id = this.nextId++;
      const newBerry = {
        id,
        embeddings: [sanitizeEmbedding(embedding)],
        lastBBox: detection.bbox,
        lastSeenFrame: frameIndex,
        seenCount: 1,
        class_idx: detection.class_idx,
        kf: new SimpleKalman(
          detection.bbox[0],
          detection.bbox[1],
          detection.bbox[2],
          detection.bbox[3]
        )
      };
      this.items.push(newBerry);
      this.usedIds.add(id); // ID für diesen Frame sperren
      return id;
    }
  }
}

// Hilfsfunktionen bleiben gleich
function sanitizeEmbedding(embedding) {
  return Array.from(embedding).map(v => (Number.isFinite(v) ? v : 0));
}

function embeddingDistance(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
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
