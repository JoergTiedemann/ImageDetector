import "./assets/App.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { model_loader,model_loadernew,load_modelEmbedding,detectBackend,isIPhoneSEDevice } from "./utils/model_loader";
import { inference_pipeline } from "./utils/inference_pipeline";
import { render_overlay} from "./utils/render_overlay";
import { countBerryArrayByClass} from "./tracking/BerryMatcher";


import classes from "./utils/yolo_classes.json";
import berry  from "./utils/berry_classes.json";
import packageJson from "../package.json"; // Pfad anpassen!
const appVersion = packageJson.version;
const isIPhoneSE = isIPhoneSEDevice();
let inputCanvas = null;
let ctx = null;

// Globales Objekt für die maximale Anzahl an Boundingboxes pro Frame
let MaxValues = {
  MaxBerryCount: 0,
  ReifBerryCount: 0,
  UnReifBerryCount: 0,
  HalbReifBerryCount: 0,
};


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
  model: "berry9k_Epoch100_320",
  model_path: "",
  task: "detect",
  imgsz_type: "zeroPad320", // "dynamic", "zeroPad" oder "zeroPad320"
  repeatFrameCount: 10,   // Anzahl Frames, die eine Beere mindestens erkannt werden muss, um als "confirmed" zu gelten
  classes: { classes: [...berry.berry9k] },
};



function App() {
  const [processingStatus, setProcessingStatus] = useState({
    warnUpTime: 0,
    inferenceTime: 0,
    statusMsg: "Model not loaded",
    statusColor: "inherit",
  });

// --- Eruda Debug Console für iPhone Safari ---
useEffect(() => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => {
      window.eruda.init({
        tool: ['console', 'network', 'resources', 'info']
      });
      console.log("Eruda Debug-Konsole aktiviert (iPhone Safari)");
    };
    document.body.appendChild(script);

  }
}, []);


  const modelConfigRef = useRef(MODEL_CONFIG);

  // resource reference
  const backendSelectorRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const taskSelectorRef = useRef(null);
  const cameraSelectorRef = useRef(null);
  const imgszTypeSelectorRef = useRef(null);
  const sessionRef = useRef(null);
  const [multiImageUrls, setMultiImageUrls] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // content reference
  const imgRef = useRef(null);
  const overlayRef = useRef(null);
  const cameraRef = useRef(null);
  const fileImageRef = useRef(null);
  const isCameraActiveRef = useRef(false);
  const firstCameraInitDone = useRef(false); // außerhalb von getCameras, z. B. im Component Body
  const loadingRef = useRef(false);
  // Referenz für das Embedding-Modell
  const embeddingSessionRef = useRef(null);

  // state
  const [customModels, setCustomModels] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [imgSrc, setImgSrc] = useState(null);
  
  const [details, setDetails] = useState([]);
  const [activeFeature, setActiveFeature] = useState(null); // null, 'video', 'image', 'camera'

  // custom classes
  const [customClasses, setCustomClasses] = useState([]);
  const classFileSelectedRef = useRef(null);
  // const [currentClasses, setCurrentClasses] = useState(classes);


// Init page
  useEffect(() => {
    loadModel();
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
    };
    window.addEventListener("beforeunload", cleanup);
    return () => window.removeEventListener("beforeunload", cleanup);
  }, []);


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
    // Embedding-Session freigeben
    if (embeddingSessionRef.current) {
      try {
        await embeddingSessionRef.current.release?.();
        embeddingSessionRef.current.dispose?.();
        console.log("Alte Embedding-Session freigegeben");
      } catch (disposeErr) {
        console.warn("Fehler beim Freigeben der alten Embedding-Session:", disposeErr);
      }
      embeddingSessionRef.current = null;
    }

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

    console.log("Lade Modell von:", model_path);
    console.log("ImageSize:", modelConfig.imgsz_type);

    // Embedding-Modellpfad bestimmen
    // Annahme: gleiches Verzeichnis, Name: embedding9k_100-detect.onnx
    const embeddingModelPath = `${window.location.href}/models/embedding9k_100_single-detect.onnx`;

    let backend = await detectBackend();
    console.log("Start Model laden");
    const start = performance.now();
    let yolo_model;
    let provider;
    // wenn das backend auf auto steht, automatisch wählen
    if (modelConfig.backend === "auto") {
      if (backend === "webgpu") {
        const result  = await model_loadernew(model_path,modelConfig.imgsz_type);
        yolo_model = result.yolo_model;
        provider  = result.provider;
      }else {
        const result = await model_loader(model_path, backend,modelConfig.imgsz_type);
        yolo_model = result.yolo_model;
        provider = result.provider;
      }
    } else {
      // festes backend
      backend = modelConfig.backend;
      const result = await model_loader(model_path, backend,modelConfig.imgsz_type);
      yolo_model = result.yolo_model;
      provider = result.provider;
    }
    // console.log("Ende Model laden");
    backend = provider;
    const end = performance.now();

    sessionRef.current = yolo_model;

    // Embedding-Modell laden
    try {
      const embeddingResult = await load_modelEmbedding(embeddingModelPath, backend);
      embeddingSessionRef.current = embeddingResult;
      console.log("Embedding-Modell geladen Current:", embeddingSessionRef.current);
    } catch (embeddingErr) {
      console.warn("Fehler beim Laden des Embedding-Modells:", embeddingErr);
      embeddingSessionRef.current = null;
    }
    // embeddingSessionRef.current = null;

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


  // Button Upload Image
  // Mehrfachauswahl: mehrere Bilder nacheinander laden und erkennen
  const handle_OpenImage = useCallback(
    async (imgUrls = null) => {
      if (imgUrls && Array.isArray(imgUrls)) {
        setMultiImageUrls(imgUrls);
        setCurrentImageIndex(imgUrls.length - 1);

        let allTracked = [];
        let allGlobalBerryInfo = {};
        let allUniqueBerryCount = 0;
        let lastImgUrl = null;
        for (let index = 0; index < imgUrls.length; index++) {
          lastImgUrl = imgUrls[index];
          setImgSrc(lastImgUrl);
          setActiveFeature("image");
          // Warte kurz, bis das Bild im DOM ist
          await new Promise(resolve => setTimeout(resolve, 300));
          const det = await handle_ImageLoad();
          // console.log(`Erkennung für Bild ${index + 1}/${imgUrls.length} abgeschlossen`);
          // console.log("Details:", det);
          // console.log("GloalBerryInfo aktuell:", det.globalBerryInfo.classMap);
          if (det && det.frameDetections) {
            // Bildnummer (imageIndex) zu jedem Detektionseintrag hinzufügen
            const imageIndex = index + 1;
            const trackedWithIndex = det.frameDetections.map(obj => ({ ...obj, imageIndex }));
            allTracked = allTracked.concat(trackedWithIndex);
            allUniqueBerryCount += det.uniqueBerryCount || 0;
            if (det.globalBerryInfo && det.globalBerryInfo.classMap) {
              const classMap = det.globalBerryInfo.classMap;
              // Map-Objekt
              for (const [key, value] of classMap.entries()) {
                // console.log(`Kumulieren Klasse (Map) ${key}:`, value);
                allGlobalBerryInfo[key] = (allGlobalBerryInfo[key] || 0) + value;
              }
            }
          }
        }
        // console.log("GlobalBerryInfo:", allGlobalBerryInfo);

        setDetails({
          bildanalyse: imgUrls.length,
          frameDetections: allTracked,
          uniqueBerryCount: allUniqueBerryCount,
          globalBerryInfo: allGlobalBerryInfo,
        });
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: `Erkennung für ${imgUrls.length} Bilder abgeschlossen`,
          statusColor: "green",
        }));
        setActiveFeature("image");
      } else if (imgUrls) {
        setImgSrc(imgUrls);
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
        setMultiImageUrls([]);
        setCurrentImageIndex(0);
      }
    },
    [imgSrc]
  );

    const handle_ImageLoadDummy = useCallback(async (updateDetails = true) => {
    }, [sessionRef.current]);

  // If image loaded, run inference
  const handle_ImageLoad = useCallback(async (updateDetails = true) => {
    overlayRef.current.width = imgRef.current.width;
    overlayRef.current.height = imgRef.current.height;
    const tracked = [];
    try {
      console.log("Starte Inferenz für Bild…");
      const [results, results_inferenceTime] = await inference_pipeline(
        imgRef.current,
        sessionRef.current,
        [overlayRef.current.width, overlayRef.current.height],
        modelConfigRef.current
      );
      const overlayCtx = overlayRef.current.getContext("2d");
      overlayCtx.clearRect(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height
      );
      await render_overlay(
        results,
        overlayCtx,
        modelConfigRef.current.classes
      );

      let id = 0;
      for (const det of results.bbox_results) {
        id++;
        tracked.push({
          ...det,
          id,
          imageWidth: overlayCtx.canvas.width,
          imageHeight: overlayCtx.canvas.height
        });
      }
      const detObj = {
        bildanalyse: 1,
        frameDetections: tracked,
        uniqueBerryCount: tracked.length,
        globalBerryInfo: countBerryArrayByClass(results.bbox_results)
      };
      // console.log("handle_ImageLoad - updateDetails:", updateDetails);
      if (updateDetails === true)
      {
          setDetails(detObj);
      }
      setProcessingStatus((prev) => ({
        ...prev,
        inferenceTime: results_inferenceTime,
      }));
      return detObj;
    } catch (error) {
      console.error("Image processing error:", error);
      return null;
    }
  }, [sessionRef.current]);


  const handle_NavigateImage = useCallback(async (direction) => {
    if (!multiImageUrls.length) return;
    let newIndex = currentImageIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= multiImageUrls.length) newIndex = multiImageUrls.length - 1;
    setCurrentImageIndex(newIndex);
    setImgSrc(multiImageUrls[newIndex]);
    setActiveFeature("image");
    setTimeout(() => {
      handle_ImageLoad(false);
    }, 300);
  }, [multiImageUrls, currentImageIndex, handle_ImageLoad]);


  // Get camera list
  const getCameras = useCallback(async () => {
    /*
    hier wird beim ersten Aufruf versucht die Rückkamera zu wählen (sofern vorhanden).
    Dazu wird geprüft, ob der Kameraname "back" oder "rear" oder "rück" enthält.
    Wenn ja, wird diese Kamera als defaultDeviceId zurückgegeben.
    Beim nächsten Aufruf wird die zuletzt ausgewählte Kamera verwendet und als defaultDeviceId zurückgegeben.
    */
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

      let defaultDeviceId = "";

      if (!firstCameraInitDone.current) {
        const backCam = videoDevices.find(cam =>
          cam.label.toLowerCase().includes("back") ||
          cam.label.toLowerCase().includes("rear") ||
          cam.label.toLowerCase().includes("rück")
        );
        defaultDeviceId = backCam?.deviceId || videoDevices[0]?.deviceId || "";
        firstCameraInitDone.current = true;
        console.log("Rückkamera beim ersten Mal gewählt:", defaultDeviceId);
      } else if (cameraSelectorRef.current) {
        defaultDeviceId = cameraSelectorRef.current.value || "";
        console.log("Bestehende Kameraauswahl übernommen:", defaultDeviceId);
      }

      return { devices: videoDevices, defaultDeviceId };
    } catch (err) {
      console.error("Error enumerating devices:", err);
      setCameras([]);
      return { devices: [], defaultDeviceId: "" };
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
      isCameraActiveRef.current = false;

      // console.log("Endergebnis:", result);
      // Ausgabe: { unreif: X, mittelreif: Y, reif: Z }
      // setDetails({
      //   bildanalyse: 0,
      //   // frameDetections: tracked,
      //   // uniqueBerryCount: berries.items.length,
      //   globalBerryInfo: countBerriesByClass(berryReIdManager)   // <- neu
      // });
      // setDetails([]);
      setActiveFeature(null);
    } else {
      // MaxValues initialisieren
      MaxValues.MaxBerryCount = 0;
      MaxValues.ReifBerryCount = 0;
      MaxValues.UnReifBerryCount = 0;
      MaxValues.HalbReifBerryCount = 0;
      // open camera
      isCameraActiveRef.current = true;
      try {
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: "Kameraliste auslesen...",
          statusColor: "blue",
        }));
        const { devices, defaultDeviceId } = await getCameras();
        if (devices.length === 0) {
          throw new Error("keine Kameras gefunden");
        }

        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: "öffne Kamera...",
          statusColor: "blue",
        }));

        const selectedDeviceId = cameraSelectorRef.current
          ? cameraSelectorRef.current.value || defaultDeviceId
          : defaultDeviceId;


        // const selectedDeviceId = cameraSelectorRef.current
        //   ? cameraSelectorRef.current.value
        //   : currentCameras[0].deviceId;

          console.log("DeviceID:",selectedDeviceId);
          setProcessingStatus((prev) => ({
            ...prev,
            statusMsg: `Kamera:${selectedDeviceId}...`,
            statusColor: "green",
          }));

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

    // // create offscreen canvas for input
    // let inputCanvas = new OffscreenCanvas(
    //   cameraRef.current.videoWidth,
    //   cameraRef.current.videoHeight
    // );
    inputCanvas = document.createElement("canvas");
    inputCanvas.width = cameraRef.current.videoWidth;
    inputCanvas.height = cameraRef.current.videoHeight;

    ctx = inputCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    // inference loop

    // ================= handle_frame_continuous =================
    const handle_frame_continuous = async () => {
      if (!cameraRef.current?.srcObject) {
        inputCanvas = null;
        ctx = null;
        return;
      }
      if (!isCameraActiveRef.current) return;

      // 🔥 Canvas korrekt initialisieren (NICHT OffscreenCanvas!)
      if (!inputCanvas) {
        inputCanvas = document.createElement("canvas");
      }

      inputCanvas.width = cameraRef.current.videoWidth;
      inputCanvas.height = cameraRef.current.videoHeight;
      ctx = inputCanvas.getContext("2d", { willReadFrequently: true });

      // Kamera auf Input-Canvas
      ctx.drawImage(
        cameraRef.current,
        0,
        0,
        cameraRef.current.videoWidth,
        cameraRef.current.videoHeight
      );
      // console.log("Canvas size:", ctx.canvas.width, ctx.canvas.height);
      // console.log("ctx:", ctx);


      // Inference
      const [results, results_inferenceTime] = await inference_pipeline(
        inputCanvas,
        sessionRef.current,
        [overlayRef.current.width, overlayRef.current.height],
        modelConfigRef.current
      );

      const overlayCtx = overlayRef.current.getContext("2d");
      overlayCtx.clearRect(
        0,
        0,
        overlayCtx.canvas.width,
        overlayCtx.canvas.height
      );

      const tracked = [];

      // Overlay
      render_overlay(results, overlayCtx, modelConfigRef.current.classes);

        let id = 0;
      for (const det of results.bbox_results) {
          id++;
          tracked.push({
            ...det,
            id,
            imageWidth: overlayCtx.canvas.width,
            imageHeight: overlayCtx.canvas.height
          });

        const detg = {
          globalBerryInfo: countBerryArrayByClass(results.bbox_results)
        };

        // nun die Maxwerte aktualisieren, wenn die aktuelle Anzahl an Boundingboxes größer ist
        // console.log(`Aktuelle Berry-Anzahl: ${results.bbox_results.length}, MaxBerryCount bisher: ${MaxValues.MaxBerryCount}`);
        if (results.bbox_results.length >  MaxValues.MaxBerryCount) {
          MaxValues.MaxBerryCount = results.bbox_results.length;
          let allGlobalBerryInfo = {};

          if (detg.globalBerryInfo && detg.globalBerryInfo.classMap) {
            const classMap = detg.globalBerryInfo.classMap;
            // Map-Objekt
            for (const [key, value] of classMap.entries()) {
              // console.log(`Kumulieren Klasse (Map) ${key}:`, value);
              allGlobalBerryInfo[key] = (allGlobalBerryInfo[key] || 0) + value;
            }
            MaxValues.ReifBerryCount= (allGlobalBerryInfo[0] || 0);
            MaxValues.UnReifBerryCount=(allGlobalBerryInfo[2] || 0);
            MaxValues.HalbReifBerryCount=(allGlobalBerryInfo[1] || 0);
            console.log(`Max Berries:${MaxValues.MaxBerryCount} Reif:`, MaxValues.ReifBerryCount, "Unreif:", MaxValues.UnReifBerryCount, "HalbReif:", MaxValues.HalbReifBerryCount);
            const detObj = {
              bildanalyse: 0,
              uniqueBerryCount: MaxValues.MaxBerryCount,
              reifCount: MaxValues.ReifBerryCount,
              unreifCount: MaxValues.UnReifBerryCount,
              halbReifCount: MaxValues.HalbReifBerryCount,
            };
            setDetails(detObj);
          }
        }
      }

      setProcessingStatus(prev => ({
        ...prev,
        inferenceTime: results_inferenceTime
      }));

      requestAnimationFrame(handle_frame_continuous);
    };
    requestAnimationFrame(handle_frame_continuous);
  }, [sessionRef.current]);

  
return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 bg-gray-900 min-h-screen">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 sm:mb-6 text-white">
        <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
          Smart Fruit Finder {appVersion}
        </span>
      </h1>

      {multiImageUrls.length > 1 && activeFeature === "image" && (
        <div className="flex items-center justify-center gap-3 w-full max-w-4xl mx-auto mb-4">

          {/* Previous Button */}
          <button
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 
                      text-white px-3 py-3 rounded-xl w-32 sm:w-40 
                      text-lg font-semibold shadow-md active:scale-95 
                      disabled:opacity-40 disabled:scale-100 transition-all"
            onClick={() => handle_NavigateImage(-1)}
            disabled={currentImageIndex === 0}
          >
            <span className="text-2xl text-gray-200">❮</span>
            <span className="hidden sm:inline">Zurück</span>
          </button>

          {/* Counter */}
          <span className="text-gray-300 text-lg font-semibold text-center whitespace-nowrap flex-1">
            Bild {currentImageIndex + 1} / {multiImageUrls.length}
          </span>

          {/* Next Button */}
          <button
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 
                      text-white px-3 py-3 rounded-xl w-32 sm:w-40 
                      text-lg font-semibold shadow-md active:scale-95 
                      disabled:opacity-40 disabled:scale-100 transition-all"
            onClick={() => handle_NavigateImage(1)}
            disabled={currentImageIndex === multiImageUrls.length - 1}
          >
            <span className="hidden sm:inline">Weiter</span>
            <span className="text-2xl text-gray-200">❯</span>
          </button>
        </div>
      )}

      <ImageDisplay
        cameraRef={cameraRef}
        imgRef={imgRef}
        overlayRef={overlayRef}
        imgSrc={imgSrc}
        onCameraLoad={handle_cameraLoad}
        onImageLoad={handle_ImageLoadDummy}
        // onVideoEnd={() => setActiveFeature(null)} // Neu: Setze activeFeature zurück
        activeFeature={activeFeature}
      />      
      <ControlButtons
        imgSrc={imgSrc}
        fileImageRef={fileImageRef}
        handle_OpenImage={handle_OpenImage}
        handle_ToggleCamera={handle_ToggleCamera}
        activeFeature={activeFeature}
        isiPhoneSe={isIPhoneSE}
      />
      <ResultsTable
        details={details}
        currentClasses={modelConfigRef.current.classes.classes}
        currentImageIndex={currentImageIndex}
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