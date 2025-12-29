import { InferenceSession, Tensor} from "onnxruntime-web/webgpu";

function detectAvailableProviders() {
  const providers = [];

  // WebGPU prüfen
  if (typeof navigator !== "undefined" && navigator.gpu) {
    providers.push("webgpu");
  }

  // WebGL prüfen
  try {
    const canvas = document.createElement("canvas");
    if (canvas.getContext("webgl")) {
      providers.push("webgl");
    }
  } catch (e) {
    // kein WebGL
  }

  // WASM ist immer verfügbar
  providers.push("wasm");

  return providers;
}

export async function model_loadernew(model_path) {
  const DEFAULT_INPUT_SIZE = [1, 3, 640, 640];

  const availableProviders = detectAvailableProviders();
  console.log("Verfügbare Provider:", availableProviders);

  // Priorität: webgpu → webgl → wasm
  const priority = ["webgpu", "webgl", "wasm"];
  // const priority = ["wasm"];
  const selectedProvider = priority.find(p => availableProviders.includes(p));

  console.log("Lade Modell mit Provider:", selectedProvider);

  const yolo_model = await InferenceSession.create(model_path, {
    executionProviders: [selectedProvider],
  });

  // Warm-up
  const dummy_input_tensor = new Tensor(
    "float32",
    new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
    DEFAULT_INPUT_SIZE
  );
  await yolo_model.run({ images: dummy_input_tensor });
  dummy_input_tensor.dispose();

  return { yolo_model: yolo_model, provider: selectedProvider };
}


export async function model_loader(model_path, backend) {
  const DEFAULT_INPUT_SIZE = [1, 3, 640, 640];

  // load model
  const yolo_model = await InferenceSession.create(model_path, {
    executionProviders: [backend],
  });

  // warm up
  const dummy_input_tensor = new Tensor(
    "float32",
    new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
    DEFAULT_INPUT_SIZE
  );
  const { output0 } = await yolo_model.run({ images: dummy_input_tensor });
  output0.dispose();
  dummy_input_tensor.dispose();

  return yolo_model;
}
