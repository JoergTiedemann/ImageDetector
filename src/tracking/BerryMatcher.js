import { SimpleKalman } from "./SimpleKalman.js";

export class BerryMatcher {
  constructor() {
    this.items = [];
    this.nextId = 1;
    this.usedIds = new Set();

    this.avgEDist = 0.20;
    this.alpha = 0.05;
    this.MAX_EMBEDDINGS = 15;// war urspruenglich 5
  }

  resetFrame() {
    this.usedIds.clear();
  }

  // Hilfsfunktion: YOLO → Pixel
  toPixelBBox(bbox, imageWidth, imageHeight) {
    const [bx, by, bw, bh] = bbox;

    // Wenn Werte <= 1 sind → normalisiert
    if (bx <= 1 && by <= 1 && bw <= 1 && bh <= 1) {
      return [
        bx * imageWidth,
        by * imageHeight,
        bw * imageWidth,
        bh * imageHeight
      ];
    }

    // Sonst Pixel
    return [bx, by, bw, bh];
  }

  match(detection, embedding, frameIndex, imageWidth, imageHeight) {

    // ---------------------------------------------------------
    // FIX 3: Kalman-Prediction für alle existierenden Beeren
    // ---------------------------------------------------------
    for (const berry of this.items) {
      berry.kf.predict();
    }

    const detBBoxPx = this.toPixelBBox(detection.bbox, imageWidth, imageHeight);

    const maxEmbDist = Math.min(0.6, Math.max(0.15, this.avgEDist * 2.5));
    // const maxPosDist = Math.min(0.3, Math.max(0.05, this.avgEDist * 1.2));
    const maxPosDist = 0.5;  // robust gegen YOLO-Jitter

    const diag = Math.hypot(imageWidth, imageHeight);

    let best = null;
    let bestScore = Infinity;
    let minEDist = Infinity;
    let pDist = Infinity;

    for (const berry of this.items) {
      if (berry.class_idx !== detection.class_idx) continue;
      if (this.usedIds.has(berry.id)) continue;

      // Embedding-Distanz
      minEDist = Infinity;
      for (const emb of berry.embeddings) {
        const eDist = embeddingDistance(
          sanitizeEmbedding(embedding),
          sanitizeEmbedding(emb)
        );
        if (Number.isFinite(eDist)) {
          minEDist = Math.min(minEDist, eDist);
        }
      }

      // Positionsdistanz (Pixel!)
      pDist = bboxDistance(detBBoxPx, berry.lastBBox) / diag;

      if (minEDist > maxEmbDist) continue;
      if (pDist > maxPosDist) continue;

      const score = minEDist + pDist;
      if (score < bestScore) {
        bestScore = score;
        best = berry;
      }
    }

    // MATCH
    if (best) {
      this.avgEDist = this.avgEDist * (1 - this.alpha) + minEDist * this.alpha;

      // if (minEDist < 0.15) {
      //   best.embeddings.push(sanitizeEmbedding(embedding));
      //   if (best.embeddings.length > this.MAX_EMBEDDINGS) {
      //     best.embeddings.shift();
      //   }
      // }

      best.embeddings.push(sanitizeEmbedding(embedding));
      if (best.embeddings.length > this.MAX_EMBEDDINGS) {
          best.embeddings.shift();
      }


      best.lastBBox = detBBoxPx;
      best.lastSeenFrame = frameIndex;
      best.seenCount += 1;
      best.eDist = minEDist;
      best.pDist = pDist;

      best.kf.update({
        x: detBBoxPx[0],
        y: detBBoxPx[1],
        w: detBBoxPx[2],
        h: detBBoxPx[3]
      });

      this.usedIds.add(best.id);
      return { id: best.id, eDist: minEDist, pDist };
    }

    // NEUE BEERE
    const id = this.nextId++;
    const newBerry = {
      id,
      embeddings: [sanitizeEmbedding(embedding)],
      lastBBox: detBBoxPx,
      lastSeenFrame: frameIndex,
      seenCount: 1,
      eDist: -1,
      pDist: -1,
      class_idx: detection.class_idx,
      kf: new SimpleKalman(
        detBBoxPx[0],
        detBBoxPx[1],
        detBBoxPx[2],
        detBBoxPx[3]
      )
    };

    this.items.push(newBerry);
    this.usedIds.add(id);
    return { id, eDist: -1, pDist: -1 };
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
