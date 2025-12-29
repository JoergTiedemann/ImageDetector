import React, { memo } from "react";

const ModelStatus = memo(function ModelStatus({
  warnUpTime,
  inferenceTime,
  statusMsg,
  statusColor,
}) {
  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
      <details className="text-gray-200 group" open>
        <summary className="flex items-center cursor-pointer select-none">
          <div className="flex-1 text-lg sm:text-xl font-bold border-b border-gray-700 pb-2">
            Status-Meldungen 
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-700 p-3 rounded-lg">
              <div className="text-gray-400 text-xs sm:text-sm font-medium mb-1">
                Modell-Ladezeit
              </div>
              <div className="text-xl sm:text-2xl font-bold text-lime-500">
                {warnUpTime} ms
              </div>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <div className="text-gray-400 text-xs sm:text-sm font-medium mb-1">
                Inference Time
              </div>
              <div className="text-xl sm:text-2xl font-bold text-lime-500">
                {inferenceTime} ms
              </div>
            </div>
          </div>

          <div className="bg-gray-700 p-3 rounded-lg flex items-center">
            <div className="mr-2 sm:mr-3">
              <div
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                  statusColor === "green"
                    ? "bg-green-500"
                    : statusColor === "red"
                    ? "bg-red-500"
                    : statusColor === "blue"
                    ? "bg-blue-500"
                    : "bg-gray-500"
                } ${statusColor !== "green" ? "animate-pulse" : ""}`}
              ></div>
            </div>
            <p
              className={`${
                statusColor !== "green" ? "animate-text-loading" : ""
              } text-sm sm:text-lg`}
              style={{
                color:
                  statusColor === "green"
                    ? "#10b981"
                    : statusColor === "red"
                    ? "#ef4444"
                    : statusColor === "blue"
                    ? "#3b82f6"
                    : "#d1d5db",
              }}
            >
              {statusMsg}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
});

export default ModelStatus;
