export function computeBerryEmbedding(imageCtx, bbox) {
  const { x, y, w, h } = bbox;

  const sampleSize = 16;
  const canvas = new OffscreenCanvas(sampleSize, sampleSize);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    imageCtx.canvas,
    x, y, w, h,
    0, 0, sampleSize, sampleSize
  );

  const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

  const bins = 8;
  const hist = new Float32Array(bins * 3);

  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];

    const rBin = (r * bins) >> 8;
    const gBin = (g * bins) >> 8;
    const bBin = (b * bins) >> 8;

    hist[rBin]++;
    hist[bins + gBin]++;
    hist[2 * bins + bBin]++;
  }

  let sum = 0;
  for (let i = 0; i < hist.length; i++) sum += hist[i];
  if (sum > 0) {
    for (let i = 0; i < hist.length; i++) hist[i] /= sum;
  }

  const sizeFeature = [
    w / imageCtx.canvas.width,
    h / imageCtx.canvas.height,
    (w * h) / (imageCtx.canvas.width * imageCtx.canvas.height)
  ];

  const embedding = new Float32Array(hist.length + sizeFeature.length);
  embedding.set(hist, 0);
  embedding.set(sizeFeature, hist.length);

  return embedding;
}
