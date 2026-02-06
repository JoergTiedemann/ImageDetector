function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function colorSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return 1 - sum / 2;
}

function sizeSimilarity(a, b) {
  return 1 - Math.abs(a - b) / Math.max(a, b);
}

function combinedScore(embSim, colSim, sizeSim) {
  return 0.65 * embSim + 0.20 * colSim + 0.15 * sizeSim;
}


export const berryReIdManager = {
  archive: [],
  nextId: 1,
  minConfirmFrames: 10,   // z.B. 4 Frames nötig


  reset() {
    this.archive = [];
    this.nextId = 1;
    },


 processDetection(features, frameIndex,repeatFrameCount) {
    const { embedding, colorHist, size, class_idx } = features;

    let bestId = -1;
    let bestScore = 0;
    this.minConfirmFrames = repeatFrameCount ?? 10;  // 🔥 hier die Konfiguration nutzen
    console.log("processDetection: minConfirmedFrames:", this.minConfirmFrames);
    // -----------------------------
    // Matching berechnen
    // -----------------------------
    // das was in den letzten 600 Frames gesehen wurde, wird berücksichtigt (ca. 20 Sekunden bei 30fps)
    for (const berry of this.archive) {
      if (frameIndex - berry.lastSeen > 600) continue;

      const embSim = cosineSimilarity(embedding, berry.meanEmbedding);
      const colSim = colorSimilarity(colorHist, berry.colorHist);
      const sizeSim = sizeSimilarity(size, berry.sizeStats.mean);

      const score = 0.65 * embSim + 0.20 * colSim + 0.15 * sizeSim;

      if (score > bestScore) {
        bestScore = score;
        bestId = berry.id;
      }
    }

    // -----------------------------
    // Fall 1: Sicheres Match
    // -----------------------------
    if (bestScore > 0.985) {
      this.updateCluster(bestId, features, frameIndex);
      const berry = this.archive.find(b => b.id === bestId);
      return { 
        id: bestId, 
        score: bestScore, 
        isNew: false,
        confirmed: berry.confirmed   // 🔥 neu
      };
    }

    // -----------------------------
    // Fall 2: Sicher KEIN Match → neue ID
    // -----------------------------
    if (bestScore < 0.965) {
      const newId = this.createCluster(features, frameIndex);
      return { 
        id: newId, 
        score: 1.0, 
        isNew: true,
        confirmed: false            // 🔥 neu
      };
    }

    // -----------------------------
    // Fall 3: Mittlerer Score → Match
    // -----------------------------
    if (bestScore > 0.975) {
      this.updateCluster(bestId, features, frameIndex);
      const berry = this.archive.find(b => b.id === bestId);
      return { 
        id: bestId, 
        score: bestScore, 
        isNew: false,
        confirmed: berry.confirmed   // 🔥 neu
      };
    }

    // -----------------------------
    // Fall 4: Default → neue ID
    // -----------------------------
    const newId = this.createCluster(features, frameIndex);
    return { 
      id: newId, 
      score: 1.0, 
      isNew: true,
      confirmed: false              // 🔥 neu
    };
 },


  createCluster({ embedding, colorHist, size, class_idx }, frameIndex) {
    const id = this.nextId++;
    this.archive.push({
      id,
      embeddings: [embedding],
      meanEmbedding: embedding,
      colorHist: [...colorHist],
      sizeStats: { mean: size, var: 0 },
      class_idx: class_idx,
      lastSeen: frameIndex,
      seenCount: 1,
      confirmed: false   // 🔥 neu
    });
    return id;
  },

  updateCluster(id, { embedding, colorHist, size, class_idx }, frameIndex) {
    console.log("updateCluster: minConfirmedFrames:", this.minConfirmFrames);

    const berry = this.archive.find(b => b.id === id);
    if (!berry) return;

    berry.embeddings.push(embedding);
    if (berry.embeddings.length > 20) berry.embeddings.shift();

    const mean = new Float32Array(embedding.length);
    for (const e of berry.embeddings)
      for (let i = 0; i < mean.length; i++) mean[i] += e[i];
    for (let i = 0; i < mean.length; i++) mean[i] /= berry.embeddings.length;
    berry.meanEmbedding = mean;

    for (let i = 0; i < berry.colorHist.length; i++)
      berry.colorHist[i] = 0.8 * berry.colorHist[i] + 0.2 * colorHist[i];

    const oldMean = berry.sizeStats.mean;
    berry.sizeStats.mean = 0.8 * oldMean + 0.2 * size;
    berry.sizeStats.var = Math.abs(berry.sizeStats.mean - oldMean);

    berry.lastSeen = frameIndex;
    berry.seenCount += 1;
    // 🔥 Wenn genug Frames stabil gesehen → confirmed
    if (!berry.confirmed && berry.seenCount >= this.minConfirmFrames) {
        berry.confirmed = true;
    }
  },
}

export function countBerriesByClass(berryReIdManager) {
  const classMap = new Map();
  let total = 0;

  for (const berry of berryReIdManager.archive) {
    if (!berry.confirmed) continue;  // 🔥 nur bestätigte Beeren zählen

    const idx = berry.class_idx ?? "unknown";
    classMap.set(idx, (classMap.get(idx) || 0) + 1);
    total++;
  }

  return { classMap, total };
}

export function countBerriesConfirmed(berryReIdManager) {
  let total = 0;

  for (const berry of berryReIdManager.archive) {
    if (!berry.confirmed) continue;  // 🔥 nur bestätigte Beeren zählen

    total++;
  }

  return { total };
}


