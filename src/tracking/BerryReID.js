import { Tensor } from "onnxruntime-web";


export async function computeBerryEmbedding(ctx, det, embeddingSession) {
  if (!embeddingSession) return null;

  // YOLO liefert xywh
  let [x, y, w, h] = det.bbox.map(v => Math.max(0, Math.floor(v)));

  const x1 = x;
  const y1 = y;
  const x2 = x + w;
  const y2 = y + h;

  const cropW = x2 - x1;
  const cropH = y2 - y1;

  console.log("BBox:", det.bbox, "→ Crop:", x1, y1, cropW, cropH);

  if (cropW <= 2 || cropH <= 2) return null;

  const crop = ctx.getImageData(x1, y1, cropW, cropH);

  const resized = resizeImageData(crop, 128, 128);

  const chw = imageDataToCHW(resized);

  const inputTensor = new Tensor("float32", chw, [1, 3, 128, 128]);

  const output = await embeddingSession.run({ input: inputTensor });

  const key = Object.keys(output)[0];
  return output[key].data;
}


function imageDataToCHW(imageData) {
  const { data, width, height } = imageData;

  const chw = new Float32Array(1 * 3 * width * height);

  let idx = 0;
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        chw[idx++] = data[pixelIndex + c] / 255; // Normalisierung
      }
    }
  }

  return chw;
}

function resizeImageData(imageData, newW, newH) {
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = newW;
  tmpCanvas.height = newH;

  const tmpCtx = tmpCanvas.getContext("2d");
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = imageData.width;
  srcCanvas.height = imageData.height;
  srcCanvas.getContext("2d").putImageData(imageData, 0, 0);

  tmpCtx.drawImage(srcCanvas, 0, 0, newW, newH);

  return tmpCtx.getImageData(0, 0, newW, newH);
}
