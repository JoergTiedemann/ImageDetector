import { SimpleKalman } from "./SimpleKalman";

export class BerryMatcher {
  constructor() {
    this.items = [];
    this.nextId = 1;
  }

  match(detection, embedding, frameIndex, imageWidth, imageHeight) {
    const maxFrameGap = 200;
    const maxEmbDist = 0.4;
    const maxPosDist = 0.2;

    const diag = Math.hypot(imageWidth, imageHeight);

    let best = null;
    let bestScore = Infinity;

    for (const berry of this.items) {
      if (frameIndex - berry.lastSeenFrame > maxFrameGap) continue;

      // Embedding-Distanz robust berechnen
      const eDist = embeddingDistance(
        sanitizeEmbedding(embedding),
        sanitizeEmbedding(berry.embedding)
      );

      // Positions-Distanz robust berechnen
      const pDist = bboxDistance(detection.bbox, berry.lastBBox) / diag;

      console.log(
        "Vergleich mit Beere", berry.id,
        "eDist:", eDist.toFixed(3),
        "pDist:", pDist.toFixed(3),
        "Score:", (eDist + pDist).toFixed(3)
      );

      if (!Number.isFinite(eDist) || !Number.isFinite(pDist)) continue;
      if (eDist > maxEmbDist) continue;
      if (pDist > maxPosDist) continue;

      const score = eDist + pDist;
      if (score < bestScore) {
        bestScore = score;
        best = berry;
      }
    }

    if (best) {
      // bestehende Beere → aktualisieren
      best.embedding = sanitizeEmbedding(embedding);
      best.lastBBox = detection.bbox;   // Array [x,y,w,h]
      best.lastSeenFrame = frameIndex;
      best.seenCount += 1;
      best.class_idx = detection.class_idx;
      best.kf.update({
        x: detection.bbox[0],
        y: detection.bbox[1],
        w: detection.bbox[2],
        h: detection.bbox[3]
      });
      return best.id;
    } else {
      // neue Beere → neue ID vergeben
      const id = this.nextId++;
      this.items.push({
        id,
        embedding: sanitizeEmbedding(embedding),
        lastBBox: detection.bbox,   // Array [x,y,w,h]
        lastSeenFrame: frameIndex,
        seenCount: 1,
        class_idx: detection.class_idx,
        kf: new SimpleKalman(
          detection.bbox[0],
          detection.bbox[1],
          detection.bbox[2],
          detection.bbox[3]
        )
      });
      return id;
    }
  }
}

// Hilfsfunktionen

function sanitizeEmbedding(embedding) {
  // ersetze NaN/Infinity durch 0
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