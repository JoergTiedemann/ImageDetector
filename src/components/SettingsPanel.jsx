import React, { memo } from "react";
import berry from "../utils/berry_classes.json";

const modelClassMap = {
  berry2k_100: "berry",
  berry9k_Epoch100: "berry9k",
  yolo11n: "default",
  yolo11s: "default",
  yolo12n: "default",
};


const SettingsPanel = memo(function SettingsPanel({
  backendSelectorRef,
  modelSelectorRef,
  cameraSelectorRef,
  imgszTypeSelectorRef,
  modelConfigRef,
  customClasses,
  classFileSelectedRef,
  cameras,
  customModels,
  loadModel,
  activeFeature,
  defaultClasses,
}) {
  return (
    <div
      id="setting-container"
      className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6 overflow-hidden"
    >
      <details className="text-gray-200 group" >
        <summary className="flex items-center cursor-pointer select-none">
          <div className="flex-1 text-lg sm:text-xl font-bold border-b border-gray-700 pb-2">
            Einstellungen
          </div>
          <div className="text-gray-400">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 transform group-open:rotate-180 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </summary>

        <div className="transition-all duration-300 ease-in-out transform origin-top group-open:animate-details-show mt-3 sm:mt-4">
          {/* --- Verfahren & Modell --- */}
          <div className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">
                  KI-Prozessor:
                </label>
                <select
                  name="device-selector"
                  ref={backendSelectorRef}
                  onChange={(e) => {
                    modelConfigRef.current.backend = e.target.value;
                    loadModel();
                  }}
                  disabled={activeFeature !== null}
                  className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                >
                  <option value="auto">Automatisch</option>
                  <option value="wasm">CPU</option>
                  <option value="webgpu">Grafikprozessor</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">
                  Objektauswahl:
                </label>
                <select
                  name="model-selector"
                  ref={modelSelectorRef}
                  onChange={(e) => {
                      const selectedModel = e.target.value;
                      modelConfigRef.current.model = selectedModel;

                      // Klassen automatisch setzen
                      // console.log("selectedModel:", selectedModel);
                      const mappedClass = modelClassMap[selectedModel];
                      // console.log("mappedClass:", mappedClass," modelClassMap:", modelClassMap);
                      // console.log("berry9kclasses:", berry.berry9k);
                      if (mappedClass === "default") {
                        modelConfigRef.current.classes = defaultClasses;
                        classFileSelectedRef.current.value = "default";
                      } else if (mappedClass === "berry") {
                        modelConfigRef.current.classes = { classes: [...berry.berry] };
                        classFileSelectedRef.current.value = "berry";
                      } else if (mappedClass === "berry9k") {
                        modelConfigRef.current.classes = { classes: [...berry.berry9k] };
                        classFileSelectedRef.current.value = "berry9k";
                      }

                      // Falls du auch Custom-Modelle mit eigenen Klassen hast:
                      const customIndex = customModels.findIndex(m => m.url === selectedModel);
                      if (customIndex !== -1 && customClasses[customIndex]) {
                        modelConfigRef.current.classes = customClasses[customIndex].data;
                        classFileSelectedRef.current.value = customIndex.toString();
                      }

                      console.log("Model gewechselt:", selectedModel);
                      console.log("Neue Klassen:", modelConfigRef.current.classes);

                      loadModel();
                    }}
                  disabled={activeFeature !== null}
                  className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                >
                  <option value="berry9k_Epoch100">Blaubeeren</option>
                  <option value="berry2k_100">Blaubeeren + Blüten</option>
                  <option value="yolo11n">allgemeine Objekte (2.6M)</option>
                  {/* <option value="yolo11s">YOLO11s (9.4M)</option>
                  <option value="yolo12n">YOLO12n (2.6M)</option> */}
                  {customModels.map((model, index) => (
                    <option key={index} value={model.url}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col" hidden>
                <label className="text-gray-300 mb-1 text-sm font-medium">
                  Klassen:
                </label>
                <select
                  ref={classFileSelectedRef}
                  // dynamisch vorbelegen anhand des aktuellen Modells
                  defaultValue={
                    (() => {
                      const mappedClass = modelClassMap[modelConfigRef.current.model];
                      if (mappedClass === "default") return "default";
                      if (mappedClass === "berry") return "berry";
                      if (mappedClass === "berry9k") return "berry9k";
                      // falls Custom-Model → Index als String
                      const customIndex = customModels.findIndex(
                        m => m.url === modelConfigRef.current.model
                      );
                      return customIndex !== -1 ? customIndex.toString() : "default";
                    })()
                  }
                  disabled={activeFeature !== null}
                  onChange={(e) => {
                    if (e.target.value === "default") {
                      modelConfigRef.current.classes = defaultClasses;
                    } else if (e.target.value === "berry") {
                      modelConfigRef.current.classes = { classes: [...berry.berry] };
                    } else if (e.target.value === "berry9k") {
                      modelConfigRef.current.classes = { classes: [...berry.berry9k] };
                    } else {
                      const selectedIndex = parseInt(e.target.value);
                      modelConfigRef.current.classes = customClasses[selectedIndex].data;
                    }
                    // console.log("modelConfigRef.current.classes:", modelConfigRef.current.classes);
                  }}
                  className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                >
                  <option value="berry9k">Blaubeeren</option>
                  <option value="berry">Blaubeeren+Blüten</option>
                  <option value="default">Default Classes (COCO)</option>
                  {customClasses.map((classFile, index) => (
                    <option key={index} value={index}>
                      {classFile.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">
                  Kamera:
                </label>
                <select
                  ref={cameraSelectorRef}
                  disabled={activeFeature !== null}
                  className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                >
                  {cameras.length === 0 ? (
                    <option value="">No cameras detected</option>
                  ) : (
                    cameras.map((camera, index) => (
                      <option key={index} value={camera.deviceId}>
                        {camera.label || `Camera ${index + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">
                  Bildtyp:
                </label>
                <select
                  disabled={activeFeature !== null}
                  ref={imgszTypeSelectorRef}
                  onChange={(e) => {
                    modelConfigRef.current.imgsz_type = e.target.value;
                  }}
                  className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                >
                  <option value="zeroPad">Zero Pad</option>
                  <option value="dynamic">Dynamic</option>
                </select>
              </div> */}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
});

export default SettingsPanel;
