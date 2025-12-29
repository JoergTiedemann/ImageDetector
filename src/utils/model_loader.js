import { InferenceSession, Tensor} from "onnxruntime-web/webgpu";

// async Feature Detection
export async function detectAvailableProviders() {
  const providers = [];

  // WebGPU testen
  if (typeof navigator !== "undefined" && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        providers.push("webgpu");
      }
    } catch (e) {
      console.warn("WebGPU nicht nutzbar:", e);
    }
  }

  // WebGL testen
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (gl && gl instanceof WebGLRenderingContext) {
      providers.push("webgl");
    }
  } catch (e) {
    console.warn("WebGL nicht verfügbar:", e);
  }

  // WASM testen
  if (typeof WebAssembly === "object") {
    providers.push("wasm");
  }

  return providers;
}

export async function model_loadernew(model_path) {
  const DEFAULT_INPUT_SIZE = [1, 3, 640, 640];
  const availableProviders = await detectAvailableProviders();
  console.log("Verfügbare Provider:", availableProviders);

  const priority = ["webgpu", "webgl","wasm" ];

  let yolo_model = null;
  let selectedProvider = null;

  for (const provider of priority) {
    if (!availableProviders.includes(provider)) continue;

    console.log("Versuche Provider:", provider);
    try {
      const session = await InferenceSession.create(model_path, {
        executionProviders: [provider],
      });
      console.log("Session:", session);

      if (!session) {
        console.warn(`Provider ${provider} lieferte null, versuche nächsten...`);
        continue;
      }

      console.log("starte warmup");
      try {
        const dummy_input_tensor = new Tensor(
          "float32",
          new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
          DEFAULT_INPUT_SIZE
        );
        await session.run({ images: dummy_input_tensor });
        dummy_input_tensor.dispose();
      } catch (warmupErr) {
        console.warn(`Warm-up mit ${provider} fehlgeschlagen:`, warmupErr);
        // Session verwerfen und nächsten Provider probieren
        continue;
      }

      yolo_model = session;
      selectedProvider = provider;
      console.log("Erfolgreich geladen mit Provider:", provider);
      break;
    } catch (err) {
      console.warn(`Provider ${provider} fehlgeschlagen:`, err);
      // weiter zum nächsten Provider
    }
  }

  if (!yolo_model) {
      console.log("Sicherheitsfallback auf wasm");
    yolo_model = model_loader(model_path, "wasm");
    selectedProvider = "wasm";
    // throw new Error("Kein ausführbarer Provider konnte geladen werden!");
  }

  return { yolo_model:yolo_model, provider: selectedProvider };
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
 return {  yolo_model:yolo_model, provider: backend };
  // return yolo_model;
}
