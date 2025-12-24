import * as ort from "onnxruntime-web";

const MODEL_PATH = "best.onnx";
const CLASS_NAMES = ["ripe-blueberries"];

let session = null;

async function loadYoloModel() {
  if (!session) {
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
    });
  }
  return session;
}

function preprocess(img) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 640;
  canvas.height = 640;
  ctx.drawImage(img, 0, 0, 640, 640);

  const imageData = ctx.getImageData(0, 0, 640, 640);
  const data = Float32Array.from(imageData.data).filter((_, i) => i % 4 !== 3);

  for (let i = 0; i < data.length; i++) data[i] /= 255.0;

  const transposed = new Float32Array(3 * 640 * 640);
  const channelSize = 640 * 640;
  for (let i = 0; i < channelSize; i++) {
    transposed[i] = data[i * 3];           // R
    transposed[i + channelSize] = data[i * 3 + 1]; // G
    transposed[i + 2 * channelSize] = data[i * 3 + 2]; // B
  }

  return new ort.Tensor("float32", transposed, [1, 3, 640, 640]);
}

export async function detectBerries(img) {
  const session = await loadYoloModel();
  const inputTensor = preprocess(img);

  const feeds = {};
  feeds[session.inputNames[0]] = inputTensor;

  const output = await session.run(feeds);
  const outTensor = output[session.outputNames[0]];
  const out = outTensor.data;
  const numBoxes = outTensor.dims[0];

  const boxes = [];
  for (let i = 0; i < numBoxes; i++) {
    const offset = i * 6;
    const x1 = out[offset];
    const y1 = out[offset + 1];
    const x2 = out[offset + 2];
    const y2 = out[offset + 3];
    const score = out[offset + 4];
    const classId = out[offset + 5];

    boxes.push({
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
      score,
      classId,
      label: CLASS_NAMES[classId] ?? "Unknown",
    });
  }

  console.log("Final boxes:", boxes);
  return boxes;
}