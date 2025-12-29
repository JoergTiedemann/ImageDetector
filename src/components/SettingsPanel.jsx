import React, { memo } from "react";
import berry  from "../utils/berry_classes.json";

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
      <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-200 border-b border-gray-700 pb-2">
        Einstellungen
      </h2>

      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Verfahren:
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
              <option value="wasm">CPU</option>
              <option value="webgpu">Grafikprozessor</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              KI-Modell:
            </label>
            <select
              name="model-selector"
              ref={modelSelectorRef}
              onChange={(e) => {
                modelConfigRef.current.model = e.target.value;
                loadModel();
              }}
              disabled={activeFeature !== null}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <option value="berry2k_100">Blaubeeren (2Tsd Bilder,100 Epochen,12MB)</option>
              <option value="berry2k_50">Blaubeeren (2Tsd Bilder,50 Epochen,12MB)</option>
              <option value="best78">Blaubeeren (78 Bilder,12MB)</option>
              <option value="berry9k_Epoch8">Blaubeeren (9Tsd Bilder,8 Epochen,18MB)</option>
              <option value="yolo11n">YOLO11n (2.6M)</option>
              <option value="yolo11s">YOLO11s (9.4M)</option>
              <option value="yolo12n">YOLO12n (2.6M)</option>
              {customModels.map((model, index) => (
                <option key={index} value={model.url}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Klassen:
            </label>
            <select
              ref={classFileSelectedRef}
              defaultValue="default"
              disabled={activeFeature !== null}
              onChange={(e) => {
                if (e.target.value === "default") {
                  // console.log("Klasse:",defaultClasses)
                  modelConfigRef.current.classes = defaultClasses;
                } else {
                  if (e.target.value === "berry") {
                  // console.log("BerryKlasse:",berry)
                    modelConfigRef.current.classes = { classes: [...berry.berry] };
                      // modelConfigRef.current.classes = { classes: berry };

                   } else {
                  const selectedIndex = parseInt(e.target.value);
                  modelConfigRef.current.classes =
                    customClasses[selectedIndex].data;
                }
              }
                  console.log("modelConfigRef.current.classes:",modelConfigRef.current.classes)

            }}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <option value="default">Default Classes (COCO)</option>
              <option value="berry">Blaubeeren</option>
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

          <div className="flex flex-col">
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
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettingsPanel;
