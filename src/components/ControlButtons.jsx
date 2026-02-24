import React, { memo } from "react";

const bEnableLoadButtons = false;

const ControlButtons = memo(function ControlButtons({
  imgSrc,
  fileVideoRef,
  fileImageRef,
  handle_OpenImage,
  handle_ToggleCamera,
  isiPhoneSe,
  activeFeature,
}) {
  // console.log("isiPhoneSe in ControlButtons:", isiPhoneSe);
  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Input and buttons */}
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          ref={fileImageRef}
          onChange={(e) => {
            if (e.target.files.length > 0) {
              const imgUrls = Array.from(e.target.files).map(file => URL.createObjectURL(file));
              handle_OpenImage(imgUrls);
              e.target.value = null;
            }
          }}
        />

        <button
          className={`${
            activeFeature === "image" ? "btn-danger" : "btn-primary"
          } flex items-center justify-center`}
          onClick={() =>
            imgSrc ? handle_OpenImage() : fileImageRef.current.click()
          }
          disabled={activeFeature !== null && activeFeature !== "image"}
        >
          {activeFeature === "image" ? (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Bild schließen
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Bild öffnen
            </>
          )}
        </button>

        <button
          className={`${
            activeFeature === "camera" ? "btn-danger" : "btn-primary"
          } flex items-center justify-center`}
          onClick={handle_ToggleCamera}
          disabled={activeFeature !== null && activeFeature !== "camera"}
        >
          {activeFeature === "camera" ? (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Kamera schließen
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Kamera öffnen
            </>
          )}
        </button>
      </div>
    </div>
  );
});

export default ControlButtons;
