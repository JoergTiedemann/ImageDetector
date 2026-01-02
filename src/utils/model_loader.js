import { InferenceSession, Tensor} from "onnxruntime-web";
// import { InferenceSession, Tensor} from "onnxruntime-web/webgpu";

function isIPhoneSEDevice() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const width = window.screen.width;
  const height = window.screen.height;
  console.log("Screen dimensions:", width, "x", height);
  // klassische SE‑Größe: 375x667 (CSS Pixel)
  return isIOS && ((width === 375 && height === 667) ||
                   (width === 667 && height === 375) || 
                   (width === 320 && height === 568) ||
                   (width === 568 && height === 320));
}

// detectBackend.js
export async function detectBackend() {
  // Hilfsfunktion: prüft ob WebGPU wirklich nutzbar ist
  async function canUseWebGPU() {
    try {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);

  // iPhone SE über Screen-Größe erkennen (kleiner Speicher)
  let isIPhoneSE = false;
  if (typeof globalThis.window !== "undefined") {
    // Main Thread
    isIPhoneSE = isIPhoneSEDevice();
  }

  // Entscheidung
  if (isIPhoneSE) {
    console.log("iPhone SE erkannt → Backend = webgpu test");
    return "webgpu";
  }

  if (isIOS) {
    console.log("iOS erkannt → Backend = WebGPU testen");
    return "webgpu";
  }

  if (await canUseWebGPU()) {
    console.log("WebGPU verfügbar → Backend = webgpu");
    return "webgpu";
  }

  console.log("Kein WebGPU → Backend = wasm");
  return "wasm";
}

export async function model_loadernew(model_path) {
  const DEFAULT_INPUT_SIZE = [1, 3, 640, 640];

  // Hilfsfunktion: prüft ob WebGPU wirklich nutzbar ist
  async function canUseWebGPU() {
    try {
      if (!navigator.gpu) return false;
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------
  // 1. Schnellster Provider: WEBGPU (nur wenn Adapter verfügbar)
  // ---------------------------------------------------
  if (await canUseWebGPU()) {
    try {
      console.log("Versuche Provider: webgpu");
      const session = await InferenceSession.create(model_path, {
        executionProviders: ["webgpu"],
      });

      console.log("WebGPU Session erstellt, starte Warmup…");
      const dummy = new Tensor(
        "float32",
        new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
        DEFAULT_INPUT_SIZE
      );
      await session.run({ images: dummy });
      dummy.dispose();

      console.log("Erfolgreich geladen mit Provider: webgpu");
      return { yolo_model: session, provider: "webgpu" };
    } catch (err) {
      console.warn("WebGPU fehlgeschlagen → Fallback auf WASM:", err);
      // optional: throw err, wenn du willst, dass loadModel den Fehler sieht
    }
  } else {
    console.warn("WebGPU nicht verfügbar → direkt Fallback auf WASM");
  }

  // ---------------------------------------------------
  // 2. Stabiler Fallback: WASM
  // ---------------------------------------------------
  console.log("Lade WASM Provider…");
  const session = await InferenceSession.create(model_path, {
    executionProviders: ["wasm"],
  });

  console.log("WASM Session erstellt, starte Warmup…");
  const dummy = new Tensor(
    "float32",
    new Float32Array(DEFAULT_INPUT_SIZE.reduce((a, b) => a * b)),
    DEFAULT_INPUT_SIZE
  );
  await session.run({ images: dummy });
  dummy.dispose();

  console.log("Erfolgreich geladen mit Provider: wasm");
  return { yolo_model: session, provider: "wasm" };
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
