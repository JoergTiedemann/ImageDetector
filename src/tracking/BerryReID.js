export function computeBerryEmbedding(imageCtx, detection) {
  // ------------------------------------------------
  // 0. CANVAS- UND BBOX-LOG
  // ------------------------------------------------
  // console.log("imageCtx.canvas size:", imageCtx.canvas.width, imageCtx.canvas.height);
  // console.log("raw detection:", detection);

  if (!detection || !Array.isArray(detection.bbox) || detection.bbox.length < 4) {
    console.warn("computeBerryEmbedding: invalid detection.bbox", detection);
    return new Float32Array(0);
  }

  // BBox aus Array extrahieren
  let [bx, by, bw, bh] = detection.bbox;
  // console.log("raw bbox array:", bx, by, bw, bh);

  const imgW = imageCtx.canvas.width;
  const imgH = imageCtx.canvas.height;

  // ------------------------------------------------
  // 1. FALL A: BBOX IST NORMIERT (0–1) → AUF PIXEL SKALIEREN
  // ------------------------------------------------
  if (bw > 0 && bw <= 1 && bh > 0 && bh <= 1 && bx <= 1 && by <= 1) {
    // console.log("BBox appears normalized, scaling to pixels");
    bx = bx * imgW;
    by = by * imgH;
    bw = bw * imgW;
    bh = bh * imgH;
  }

  // Sicherheit: alles auf Zahlen clampen
  if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bw) || !Number.isFinite(bh)) {
    console.warn("computeBerryEmbedding: non-finite bbox values after scaling", bx, by, bw, bh);
    return new Float32Array(0);
  }

  // ------------------------------------------------
  // 2. BBOX ERWEITERN + QUADRATISCH MACHEN
  // ------------------------------------------------
  const pad = 1.0; // 100% Padding für viel Kontext
  const size = Math.max(bw, bh);

  let px = bx - size * pad;
  let py = by - size * pad;
  let pw = size * (1 + 2 * pad);
  let ph = size * (1 + 2 * pad);

  // Optional: auf Bildgrenzen clampen, damit wir nicht komplett rausfallen
  const right = Math.min(px + pw, imgW);
  const bottom = Math.min(py + ph, imgH);
  px = Math.max(0, px);
  py = Math.max(0, py);
  pw = Math.max(1, right - px);
  ph = Math.max(1, bottom - py);

  // console.log("drawImage coords (px, py, pw, ph):", px, py, pw, ph);

  // ------------------------------------------------
  // 3. PATCH SAMPLEN (64×64)
  // ------------------------------------------------
  const sampleSize = 64;
  const canvas = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    imageCtx.canvas,
    px, py, pw, ph,
    0, 0, sampleSize, sampleSize
  );

  const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

  // ------------------------------------------------
  // 4. DEBUG: PATCH-MEANS UND -STD (ROH)
  // ------------------------------------------------
  let dbgMean = [0, 0, 0];
  let dbgStd = [0, 0, 0];
  const N = sampleSize * sampleSize;

  for (let i = 0; i < imgData.length; i += 4) {
    dbgMean[0] += imgData[i];
    dbgMean[1] += imgData[i + 1];
    dbgMean[2] += imgData[i + 2];
  }
  dbgMean = dbgMean.map(v => v / N);

  for (let i = 0; i < imgData.length; i += 4) {
    dbgStd[0] += (imgData[i]     - dbgMean[0]) ** 2;
    dbgStd[1] += (imgData[i + 1] - dbgMean[1]) ** 2;
    dbgStd[2] += (imgData[i + 2] - dbgMean[2]) ** 2;
  }
  dbgStd = dbgStd.map(v => Math.sqrt(v / N));

  // console.log("PATCH MEAN RGB:", dbgMean);
  // console.log("PATCH STD RGB:", dbgStd);

  // ------------------------------------------------
  // 5. PIXEL SANITIZEN (NaN → 0)
  // ------------------------------------------------
  for (let i = 0; i < imgData.length; i++) {
    if (!Number.isFinite(imgData[i])) imgData[i] = 0;
  }

  // ------------------------------------------------
  // 6. COLOR MOMENTS (9 Werte)
  // ------------------------------------------------
  let mean = [0, 0, 0];
  let std = [0, 0, 0];
  let skew = [0, 0, 0];

  for (let i = 0; i < imgData.length; i += 4) {
    mean[0] += imgData[i];
    mean[1] += imgData[i + 1];
    mean[2] += imgData[i + 2];
  }
  mean = mean.map(v => v / N);

  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i]     - mean[0];
    const g = imgData[i + 1] - mean[1];
    const b = imgData[i + 2] - mean[2];

    std[0] += r * r;
    std[1] += g * g;
    std[2] += b * b;

    skew[0] += r * r * r;
    skew[1] += g * g * g;
    skew[2] += b * b * b;
  }

  std = std.map(v => Math.sqrt(v / N));
  skew = skew.map(v => Math.cbrt(v / N));

  const colorMoments = [...mean, ...std, ...skew]; // 9

  // ------------------------------------------------
  // 7. GRADIENT HISTOGRAM (16 Werte)
  // ------------------------------------------------
  const bins = 8;
  const gradHist = new Float32Array(bins * 2);

  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const idx = (y * sampleSize + x) * 4;

      const gx = (imgData[idx + 4] || 0) - (imgData[idx - 4] || 0);
      const gy = (imgData[idx + sampleSize * 4] || 0) - (imgData[idx - sampleSize * 4] || 0);

      const mag = Math.sqrt(gx * gx + gy * gy) || 0;
      const angle = ((Math.atan2(gy, gx) + Math.PI) / (2 * Math.PI)) || 0;

      const magBin = Math.min(bins - 1, Math.max(0, Math.floor(mag / 32)));
      const angBin = Math.min(bins - 1, Math.max(0, Math.floor(angle * bins)));

      gradHist[magBin]++;
      gradHist[bins + angBin]++;
    }
  }

  let sumGrad = gradHist.reduce((a, b) => a + b, 0);
  if (sumGrad > 0) {
    for (let i = 0; i < gradHist.length; i++) gradHist[i] /= sumGrad;
  }

  // ------------------------------------------------
  // 8. DCT LOW-FREQ (16×16 Block → 48 Werte)
  // ------------------------------------------------
  const dctSize = 16;
  const dct = [];

  const gray = [];
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    gray.push(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const block = [];
  for (let y = 0; y < dctSize; y++) {
    for (let x = 0; x < dctSize; x++) {
      block.push(gray[y * sampleSize + x] || 0);
    }
  }

  for (let u = 0; u < dctSize; u++) {
    for (let v = 0; v < dctSize; v++) {
      let sum = 0;
      for (let y = 0; y < dctSize; y++) {
        for (let x = 0; x < dctSize; x++) {
          sum +=
            block[y * dctSize + x] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * dctSize)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * dctSize));
        }
      }
      dct.push(sum || 0);
    }
  }

  const dctLow = dct.slice(1, 49); // 48 Werte

  // ------------------------------------------------
  // 9. SIZE FEATURES (4 Werte, aus Original-BBox)
  // ------------------------------------------------
  const sizeFeat = [
    bw / (imgW || 1),
    bh / (imgH || 1),
    (bw * bh) / ((imgW * imgH) || 1),
    bw / (bh || 1)
  ];

  // ------------------------------------------------
  // 10. ALLES ZUSAMMEN
  // ------------------------------------------------
  let embedding = [
    ...colorMoments,  // 9
    ...gradHist,      // 16
    ...dctLow,        // 48
    ...sizeFeat       // 4
  ];

  // NaN-Cleanup
  for (let i = 0; i < embedding.length; i++) {
    if (!Number.isFinite(embedding[i])) embedding[i] = 0;
  }

  // L2-Norm
  const norm = Math.hypot(...embedding);
  if (norm > 0) embedding = embedding.map(v => v / norm);

  return new Float32Array(embedding);
}