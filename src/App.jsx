import "./assets/App.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { model_loader,model_loadernew,detectBackend,isIPhoneSEDevice } from "./utils/model_loader";
import { inference_pipeline } from "./utils/inference_pipeline";
import { render_overlay } from "./utils/render_overlay";
import classes from "./utils/yolo_classes.json";
import berry  from "./utils/berry_classes.json";
import packageJson from "../package.json"; // Pfad anpassen!
const appVersion = packageJson.version;
const isIPhoneSE = isIPhoneSEDevice();


// Components
import SettingsPanel from "./components/SettingsPanel";
import ImageDisplay from "./components/ImageDisplay";
import ControlButtons from "./components/ControlButtons";
import ModelStatus from "./components/ModelStatus";
import ResultsTable from "./components/ResultsTable";

// hier die Initialwerte besetzen
const MODEL_CONFIG = {
  input_shape: [1, 3, 640, 640],
  iou_threshold: 0.35,
  score_threshold: 0.45,
  backend: "auto",
  model: "berry9k_Epoch100",
  model_path: "",
  task: "detect",
  imgsz_type: "zeroPad",
  classes: { classes: [...berry.berry9k] },
};



function App() {
  const [processingStatus, setProcessingStatus] = useState({
    warnUpTime: 0,
    inferenceTime: 0,
    statusMsg: "Model not loaded",
    statusColor: "inherit",
  });

  const modelConfigRef = useRef(MODEL_CONFIG);

  // resource reference
  const backendSelectorRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const taskSelectorRef = useRef(null);
  const cameraSelectorRef = useRef(null);
  const imgszTypeSelectorRef = useRef(null);
  const sessionRef = useRef(null);
  const modelCache = useRef({});

  // content reference
  const imgRef = useRef(null);
  const overlayRef = useRef(null);
  const cameraRef = useRef(null);
  const fileImageRef = useRef(null);
  const fileVideoRef = useRef(null);

  // state
  const [customModels, setCustomModels] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [imgSrc, setImgSrc] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);

  const [details, setDetails] = useState([]);
  const [activeFeature, setActiveFeature] = useState(null); // null, 'video', 'image', 'camera'

  // custom classes
  const [customClasses, setCustomClasses] = useState([]);
  const classFileSelectedRef = useRef(null);
  // const [currentClasses, setCurrentClasses] = useState(classes);

  // Worker
  const videoWorkerRef = useRef(null);

  // Init page
  useEffect(() => {
    loadModel();

    // getCameras();

    // videoWorker.onmessage = videoWorkerMessage;
    // videoWorkerRef.current = videoWorker;
  }, []);

  // Zusätzlich: beim Verlassen der Seite Session freigeben
  useEffect(() => {
    const cleanup = () => {
      if (sessionRef.current) {
        try {
          sessionRef.current.release?.();
          sessionRef.current.dispose?.();
          console.log("Session beim Unload freigegeben");
        } catch (err) {
          console.warn("Fehler beim Freigeben beim Unload:", err);
        }
      }
      modelCache.current = {};
    };
    window.addEventListener("beforeunload", cleanup);
    return () => window.removeEventListener("beforeunload", cleanup);
  }, []);

const videoWorkerMessage = useCallback((e) => {
  setProcessingStatus((prev) => ({
    ...prev,
    statusMsg: e.data.statusMsg,
  }));
  console.log("Video Worker Message empfangen:", e.data.statusMsg);
  if (e.data.processedVideo) {
    const url = URL.createObjectURL(e.data.processedVideo);
    setVideoSrc(url); // Setze das Video für die Anzeige
    setActiveFeature("processedVideo"); // Neue Feature für verarbeitete Videos
    // Optional: URL später freigeben, z.B. beim nächsten Video oder Unmount
    // URL.revokeObjectURL(url); // Entferne dies, um das Video abzuspielen
  }
  if (e.data.abnormalTerminate) {
    console.log("Videoworker abnormal beendet, lade Modell neu");
      setActiveFeature(null);
      // loadModel();
  }
}, []);

useEffect(() => {
  return () => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
  };
}, [videoSrc]);


const loadingRef = useRef(false);

const loadModel = useCallback(async () => {
  if (loadingRef.current) {
    console.log("Model wird bereits geladen, erneuter Aufruf blockiert.");
    return;
  }
  loadingRef.current = true;

  try {
    // Alte Session freigeben
    if (sessionRef.current) {
      try {
        await sessionRef.current.release?.();
        sessionRef.current.dispose?.();
        console.log("Alte Session freigegeben");
      } catch (disposeErr) {
        console.warn("Fehler beim Freigeben der alten Session:", disposeErr);
      }
      sessionRef.current = null;
    }
    modelCache.current = {};

    setProcessingStatus(prev => ({
      ...prev,
      statusMsg: "Lade Modell...",
      statusColor: "red",
    }));
    setActiveFeature("loading");

    const modelConfig = modelConfigRef.current;
    const customModel = customModels.find(m => m.url === modelConfig.model);
    const model_path = customModel
      ? customModel.url
      : `${window.location.href}/models/${modelConfig.model}-${modelConfig.task}.onnx`;
    modelConfig.model_path = model_path;

    let backend = await detectBackend();
    console.log("Start Model laden");
    const start = performance.now();
    let yolo_model;
    let provider;
    // wenn das backend auf auto steht, automatisch wählen
    if (modelConfig.backend === "auto") {
      if (backend === "webgpu") {
        const result  = await model_loadernew(model_path);
        yolo_model = result.yolo_model;
        provider  = result.provider;
      }else {
        const result = await model_loader(model_path, backend);
        yolo_model = result.yolo_model;
        provider = result.provider;
      }
    } else {
      // festes backend
      backend = modelConfig.backend;
      const result = await model_loader(model_path, backend);
      yolo_model = result.yolo_model;
      provider = result.provider;
    }
    console.log("Ende Model laden");
    backend = provider;
    const end = performance.now();

    sessionRef.current = yolo_model;
    const cacheKey = `${modelConfig.model}-${modelConfig.task}-${backend}`;
    modelCache.current[cacheKey] = yolo_model;

    setProcessingStatus(prev => ({
      ...prev,
      statusMsg: "Modell geladen: " + provider,
      statusColor: "green",
      warnUpTime: (end - start).toFixed(2),
    }));
  } catch (error) {
    console.error("catch:" + error.message);
    setProcessingStatus(prev => ({
      ...prev,
      statusMsg: "Modell konnte nicht geladen werden: " + error.message,
      statusColor: "red",
    }));
  } finally {
    setActiveFeature(null);
    loadingRef.current = false;
  }
}, [customModels]);


  // Button add model
  const handle_AddModel = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const fileName = file.name.replace(".onnx", "");
      const fileUrl = URL.createObjectURL(file);
      setCustomModels((prevModels) => [
        ...prevModels,
        { name: fileName, url: fileUrl },
      ]);
    }
  }, []);

  // Button add classes file
  const handle_AddClassesFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);

        const fileName = file.name.replace(/\.json$/i, "");
        setCustomClasses((prev) => [
          ...prev,
          { name: fileName, data: jsonData },
        ]);

        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: `Classes file "${fileName}" loaded successfully`,
          statusColor: "green",
        }));
      } catch (error) {
        console.error("Error parsing JSON file:", error);
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: error.message || "Error parsing JSON file",
          statusColor: "red",
        }));
      }
    };

    reader.onerror = () => {
      setProcessingStatus((prev) => ({
        ...prev,
        statusMsg: "Failed to read file",
        statusColor: "red",
      }));
    };

    reader.readAsText(file);
  }, []);

  // Button Close Video
  const handle_CloseVideo = useCallback(() => {
    setVideoSrc(null);
    setActiveFeature(null);
    loadModel();
  }, []);

  // Button Upload Image
  const handle_OpenImage = useCallback(
    (imgUrl = null) => {
      if (imgUrl) {
        setImgSrc(imgUrl);
        setActiveFeature("image");
      } else if (imgSrc) {
        if (imgSrc.startsWith("blob:")) {
          URL.revokeObjectURL(imgSrc);
        }
        overlayRef.current.width = 0;
        overlayRef.current.height = 0;
        setImgSrc(null);
        setDetails([]);
        setActiveFeature(null);
      }
    },
    [imgSrc]
  );

  // If image loaded, run inference
  const handle_ImageLoad = useCallback(async () => {
    // overlay size = image size
    overlayRef.current.width = imgRef.current.width;
    overlayRef.current.height = imgRef.current.height;

    // inference
    try {
      const [results, results_inferenceTime] = await inference_pipeline(
        imgRef.current,
        sessionRef.current,
        [overlayRef.current.width, overlayRef.current.height],
        modelConfigRef.current
      );
      // draw results on overlay
      const overlayCtx = overlayRef.current.getContext("2d");
      overlayCtx.clearRect(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height
      );
      // console.log("Render Overlay Klassen:",modelConfigRef.current.classes);
      await render_overlay(
        results,
        overlayCtx,
        modelConfigRef.current.classes
      );

      setDetails(results.bbox_results);
      setProcessingStatus((prev) => ({
        ...prev,
        inferenceTime: results_inferenceTime,
      }));
    } catch (error) {
      console.error("Image processing error:", error);
    }
  }, [sessionRef.current]);

  // Get camera list
  function selectDefaultCamera(devices) {
    const backCam = devices.find(cam =>
      cam.label.toLowerCase().includes("back") ||
      cam.label.toLowerCase().includes("rear") ||
      cam.label.toLowerCase().includes("Rück")
    );
    if (cameraSelectorRef.current) {
      cameraSelectorRef.current.value = backCam
        ? backCam.deviceId
        : devices[0]?.deviceId || "";
    }
  }

  const getCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(d => d.kind === "videoinput");

      if (videoDevices.length > 0 && !videoDevices[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          tempStream.getTracks().forEach(track => track.stop());
          const updatedDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = updatedDevices.filter(d => d.kind === "videoinput");
        } catch (err) {
          console.error("Error getting camera permissions:", err);
        }
      }

      setCameras(videoDevices);
      selectDefaultCamera(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error("Error enumerating devices:", err);
      setCameras([]);
      if (cameraSelectorRef.current) cameraSelectorRef.current.value = "";
      return [];
    }
  }, []);


  // Button toggle camera
  const handle_ToggleCamera = useCallback(async () => {
    if (cameraRef.current.srcObject) {
      // close camera
      cameraRef.current.srcObject.getTracks().forEach((track) => track.stop());
      cameraRef.current.srcObject = null;
      overlayRef.current.width = 0;
      overlayRef.current.height = 0;

      setDetails([]);
      setActiveFeature(null);
    } else {
      // open camera
      try {
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: "Kameraliste auslesen...",
          statusColor: "blue",
        }));
        const currentCameras = await getCameras();
        if (currentCameras.length === 0) {
          throw new Error("keine Kameras gefunden");
        }

        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: "öffne Kamera...",
          statusColor: "blue",
        }));

        const selectedDeviceId = cameraSelectorRef.current
          ? cameraSelectorRef.current.value
          : (() => {
              // Suche nach Rückkamera
              const backCam = currentCameras.find(cam =>
                cam.label.toLowerCase().includes("back") ||
                cam.label.toLowerCase().includes("rear") ||
                cam.label.toLowerCase().includes("Rück")
              );
              return backCam ? backCam.deviceId : currentCameras[0].deviceId;
            })();


        // const selectedDeviceId = cameraSelectorRef.current
        //   ? cameraSelectorRef.current.value
        //   : currentCameras[0].deviceId;

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: selectedDeviceId },
            },
            audio: false,
          });

          cameraRef.current.srcObject = stream;
          setActiveFeature("camera");
          setProcessingStatus((prev) => ({
            ...prev,
            statusMsg: "Kamera erfolgreich geöffnet",
            statusColor: "green",
          }));
        } catch (streamErr) {
          console.error("Fehler beim öffnen der Kamera:", streamErr);

          setProcessingStatus((prev) => ({
            ...prev,
            statusMsg: "Versuche Kamera zu öffnen...",
            statusColor: "blue",
          }));

          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });

          cameraRef.current.srcObject = fallbackStream;
          setActiveFeature("camera");
          setProcessingStatus((prev) => ({
            ...prev,
            statusMsg: "Default camera opened (selected camera unavailable)",
            statusColor: "green",
          }));
        }
      } catch (err) {
        console.error("Error in camera toggle process:", err);
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: `Camera opened failed: ${err.message}`,
          statusColor: "red",
        }));
      }
    }
  }, [getCameras]);

  // If camera loaded, run inference continuously
  const handle_cameraLoad = useCallback(() => {
    overlayRef.current.width = cameraRef.current.clientWidth;
    overlayRef.current.height = cameraRef.current.clientHeight;

    // create offscreen canvas for input
    let inputCanvas = new OffscreenCanvas(
      cameraRef.current.videoWidth,
      cameraRef.current.videoHeight
    );
    let ctx = inputCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    // inference loop
    const handle_frame_continuous = async () => {
      if (!cameraRef.current?.srcObject) {
        inputCanvas = null;
        ctx = null;
        return;
      }
      // draw camera frame to input canvas
      ctx.drawImage(
        cameraRef.current,
        0,
        0,
        cameraRef.current.videoWidth,
        cameraRef.current.videoHeight
      );
      // Inference
      const [results, results_inferenceTime] = await inference_pipeline(
        inputCanvas,
        sessionRef.current,
        [overlayRef.current.width, overlayRef.current.height],
        modelConfigRef.current
      );
      // draw results on overlay
      const overlayCtx = overlayRef.current.getContext("2d");
      overlayCtx.clearRect(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height
      );
      render_overlay(
        results,
        overlayCtx,
        modelConfigRef.current.classes
      );
      // render_overlay(
      //   results,
      //   modelConfigRef.current.task,
      //   overlayCtx,
      //   modelConfigRef.current.classes
      // );

      setDetails(results.bbox_results);
      setProcessingStatus((prev) => ({
        ...prev,
        inferenceTime: results_inferenceTime,
      }));

      requestAnimationFrame(handle_frame_continuous);
    };
    requestAnimationFrame(handle_frame_continuous);
  }, [sessionRef.current]);

  // Button Upload Video
  const handle_OpenVideo = useCallback( async (file) => {
    if (file) {
  
      // Worker ggf. neu starten -> vorher beenden
      if (videoWorkerRef.current) {
        console.log("Beende alten Video Worker");
        videoWorkerRef.current.postMessage({ type: "cleanup" });
        // videoWorkerRef.current.terminate();
      }
      const videoWorker = new Worker(
        new URL("./utils/video_process_worker.js", import.meta.url),
        { type: "module" }
      );
      videoWorker.onmessage = videoWorkerMessage;
      videoWorkerRef.current = videoWorker;
      console.log("Starte Video Worker aus main thread");
      videoWorkerRef.current.postMessage(
        {
          file: file,
          modelConfig: modelConfigRef.current,
        },
        []
      );
      setActiveFeature("video");
    } else {
      setActiveFeature(null);
    }
  }, [videoWorkerMessage]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 bg-gray-900 min-h-screen">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 sm:mb-6 text-white">
        <span className="block sm:inline"></span>
        <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent block sm:inline">
          {" "}
          Smart Fruit Finder {appVersion}
        </span>
      </h1>
      <ImageDisplay
        cameraRef={cameraRef}
        imgRef={imgRef}
        overlayRef={overlayRef}
        imgSrc={imgSrc}
        videoSrc={videoSrc} // Neu hinzufügen
        onCameraLoad={handle_cameraLoad}
        onImageLoad={handle_ImageLoad}
        // onVideoEnd={() => setActiveFeature(null)} // Neu: Setze activeFeature zurück
        activeFeature={activeFeature}
      />      
      <ControlButtons
        imgSrc={imgSrc}
        fileVideoRef={fileVideoRef}
        fileImageRef={fileImageRef}
        handle_OpenVideo={handle_OpenVideo}
        handle_OpenImage={handle_OpenImage}
        handle_ToggleCamera={handle_ToggleCamera}
        handle_AddModel={handle_AddModel}
        handle_AddClassesFile={handle_AddClassesFile}
        handle_CloseVideo={handle_CloseVideo}
        activeFeature={activeFeature}
        isiPhoneSe={isIPhoneSE}
      />
      <ResultsTable
        details={details}
        currentClasses={modelConfigRef.current.classes.classes}
      />

      <ModelStatus
        warnUpTime={processingStatus.warnUpTime}
        inferenceTime={processingStatus.inferenceTime}
        statusMsg={processingStatus.statusMsg}
        statusColor={processingStatus.statusColor}
      />
      <SettingsPanel
        backendSelectorRef={backendSelectorRef}
        modelSelectorRef={modelSelectorRef}
        taskSelectorRef={taskSelectorRef}
        cameraSelectorRef={cameraSelectorRef}
        imgszTypeSelectorRef={imgszTypeSelectorRef}
        modelConfigRef={modelConfigRef}
        customClasses={customClasses}
        classFileSelectedRef={classFileSelectedRef}
        cameras={cameras}
        customModels={customModels}
        loadModel={loadModel}
        activeFeature={activeFeature}
        defaultClasses={classes}
      />

    </div>
  );
}

export default App;