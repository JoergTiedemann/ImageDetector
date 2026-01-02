import cv from "@techstark/opencv-js";
import { InferenceSession } from "onnxruntime-web/webgpu";
import { MP4Demuxer } from "./demuxer";
import { detectBackend } from "./model_loader";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { inference_pipeline } from "./inference_pipeline";
import { render_overlay } from "./render_overlay";

var yolo_model;

self.onmessage = async function (e) {
  const { file, modelConfig } = e.data;

  if (e.data.type === "cleanup") {
    self.postMessage({ statusMsg: `Worker shutdown` });
    // Ressourcen freigeben, z. B. Buffers schließen
    await yolo_model.release?.();
    yolo_model.dispose?.();
    self.postMessage({ statusMsg: `Worker beendet` });
    self.close();
  }
try {
  

  console.log("Start videoworker");
  self.postMessage({ statusMsg: `Worker gestartet` });

  // Model
  let backend = await detectBackend();
  // wenn das backend nicht auf auto steht, manuell vorwählen
  if (modelConfig.backend !== "auto") {
    // festes backend
    backend = modelConfig.backend;
  }
  console.log("Start videoworker backend:", backend);
  self.postMessage({ statusMsg: `Start videoworker backend:${backend}`});

   yolo_model = await InferenceSession.create(modelConfig.model_path, {
    executionProviders: [backend],
  });
  console.log("yolo model loaded in videoworker");
  self.postMessage({ statusMsg: `yolo model loaded in videoworker` });

  // State variables
  let inputCanvas, inputCtx, resultCanvas, resultCtx;
  let decoder = null;
  let encoder = null;
  let muxer = null;
  let frameCount = 0;
  let totalFrames = 0;
  let processedFrameCount = 0; // Zähler für tatsächlich verarbeitete Frames

  // Frame queue for processing
  let frameQueue = [];
  let isProcessing = true;

  // Flags to control encoder/decoder activity
  let encoderActive = true;
  let decoderActive = true;

  // Einstellungen für Frame-Skip und Max-Frames
  let frameSkip = 20; // Verarbeite jeden 20. Frame (ändere nach Bedarf, z.B. 1 für alle Frames)
  let maxFrames = 50; // Maximale Anzahl verarbeiteter Frames (ändere nach Bedarf, z.B. Infinity für unbegrenzt)
  if (backend === "webgpu") 
  {
    frameSkip = 5; // Verarbeite jeden 20. Frame (ändere nach Bedarf, z.B. 1 für alle Frames)
    maxFrames = Infinity; // Maximale Anzahl verarbeiteter Frames (ändere nach Bedarf, z.B. Infinity für unbegrenzt)
  }
  const onConfig = (config) => {
    totalFrames = config.nb_frames;

    inputCanvas = new OffscreenCanvas(config.codedWidth, config.codedHeight);
    resultCanvas = new OffscreenCanvas(config.codedWidth, config.codedHeight);
    inputCtx = inputCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    resultCtx = resultCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    // Initialize Muxer
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc", // H.264
        width: config.codedWidth,
        height: config.codedHeight,
      },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });

    // Initialize Encoder
    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (!encoderActive) return; // Deaktiviere, wenn finalizing
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => {
        console.error("Encoder Error: ", e);
        self.postMessage({ statusMsg: `Encoder Error: ${e.message}` });
      },
    });

    encoder.configure({
      codec: "avc1.640028", // H.264
      width: config.codedWidth,
      height: config.codedHeight,
      bitrate: config.bitrate || 2_000_000, // 2Mbps
    });

    // Initialize Decoder
    decoder = new VideoDecoder({
      output: (frame) => {
        if (!decoderActive) return; // Deaktiviere, wenn finalizing
        frameQueue.push(frame);
        if (isProcessing) {
          processNextFrame();
        }
      },
      error: (e) => {
        console.error("Decoder Error:", e);
        self.postMessage({ statusMsg: `Decoder Error: ${e.message}` });
      },
    });

    decoder.configure(config);

    self.postMessage({
      statusMsg: "✅ Initialize End, Start process...",
    });
  };

  // Process video chunks
  const onChunk = (chunk) => {
    if (decoder && decoder.state === "configured") {
      decoder.decode(chunk);
    } else {
      console.error("Encoder not ready");
      self.postMessage({ statusMsg: "Encoder not ready" });
    }
  };

  // Frame process function
  async function processNextFrame() {
    isProcessing = frameQueue.length === 0;
    if (isProcessing) {
      if (decoder.decodeQueueSize === 0) {
        finalizeVideo();
      }
      return;
    }

    const frame = frameQueue.shift();
    frameCount++;

    // Frame-Skip: Überspringe Frames, die nicht verarbeitet werden sollen
    if (frameCount % frameSkip !== 0) {
      frame.close();
      processNextFrame();
      return;
    }

    // Max-Frames: Stoppe Kodierung, aber lasse Decoder fertig laufen
    if (processedFrameCount >= maxFrames) {
      frame.close();
      processNextFrame();
      return;
    }

    let outputFrame = null; // Deklariere hier, um im finally zugänglich zu machen
    try {
      inputCtx.drawImage(frame, 0, 0);
      resultCtx.drawImage(frame, 0, 0);

      // Inference, Draw
      const [results, inferenceTime] = await inference_pipeline(
        inputCanvas,
        yolo_model,
        [inputCanvas.width, inputCanvas.height],
        modelConfig
      );
      await render_overlay(
        results,
        resultCtx,
        modelConfig.classes
      );

      // Create frame from result canvas
      outputFrame = new VideoFrame(resultCanvas, {
        timestamp: frame.timestamp,
        duration: frame.duration,
      });

      // Encode output frame
      encoder.encode(outputFrame);
      outputFrame.close();
      outputFrame = null; // Setze auf null, um zu signalisieren, dass es geschlossen wurde
      processedFrameCount++;

      self.postMessage({
        statusMsg: `${
          Math.floor(Date.now() / 1000) % 2 === 0 ? "⚫" : "🔴"
        } Processing - ${frameCount}/${Math.min(maxFrames, totalFrames || Infinity)} (${inferenceTime}ms)`,
        progress: totalFrames > 0 ? frameCount / Math.min(maxFrames, totalFrames) : 0,
      });
    } catch (e) {
      console.error("Frame process error:", e);
      self.postMessage({ statusMsg: `Frame process error: ${e.message}` });
    } finally {
      if (outputFrame) {
        outputFrame.close(); // Schließe, falls nicht bereits geschehen
      }
      frame.close();
      processNextFrame();
    }
  }

  // Finalize video processing
  async function finalizeVideo() {
    try {
      self.postMessage({ statusMsg: "🔄 Finalize Video Encoding..." });

      // Deaktiviere Callbacks, um Abbrüche zu vermeiden
      encoderActive = false;
      decoderActive = false;

      if (decoder && decoder.state === "configured") {
        await decoder.flush();
        await decoder.close();
      }
      if (encoder && encoder.state === "configured") {
        await encoder.flush();
        await encoder.close();
      }

      // Video muxer finalize
      if (muxer) {
        muxer.finalize();
        const buffer = muxer.target.buffer;
        const blob = new Blob([buffer], { type: "video/mp4" });
        inputCanvas = null;

        self.postMessage({
          statusMsg: "✅ Video Processing Complete!",
          processedVideo: blob,
        });
        self.close(); // Neu: Beende den Worker, um Ressourcen freizugeben
      }
    } catch (e) {
      console.error("Video Processing Error:", e);
      self.postMessage({ statusMsg: `Video Processing Error: ${e.message}` });
      await yolo_model.release?.();
      yolo_model.dispose?.();
      self.close(); // Auch bei Fehler beenden
    }
  }

  // Start demuxer
  try {
    new MP4Demuxer(file, onConfig, onChunk);
    self.postMessage({ statusMsg: "🔄 Start demuxer..." });
  } catch (e) {
    console.error("Demuxer Initialize Error:", e);
    self.postMessage({ statusMsg: `Demuxer Initialize Error: ${e.message}` });
  }
} catch (e) {
  console.error("Videoworker Fehler:", e);
        self.postMessage({
          statusMsg: `Videoworker Fehler: ${e.message}`,
          abnormalTerminate: true,
        });

}
};