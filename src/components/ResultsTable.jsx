import { memo } from "react";

const ResultsTable = memo(function ResultsTable({ details, currentClasses }) {
  const detections = details?.frameDetections || [];
  const uniqueCount = details?.uniqueBerryCount ?? 0;
  const globalBerries = details?.globalBerryInfo || []; // <- neu

  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
      <details className="text-gray-200 group">
        <summary className="flex items-center cursor-pointer select-none">
          <div className="flex-1 text-lg sm:text-xl font-bold border-b border-gray-700 pb-2">
          {globalBerries.classMap?.size !== undefined
          ? `Gesamtzanzahl Beeren: ${globalBerries.total}`
          : `Erkennungsergebnisse – Aktuell (${detections.length}) / Gesamt (${uniqueCount})`}
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
          {/* Frame-Detektionen */}
          {details.frameDetections !== undefined && (
          <>
          <h3 className="text-gray-300 font-semibold mb-2">Aktueller Frame</h3>
          {detections.length === 0 ? (
            <div className="bg-gray-700 rounded-lg p-4 text-center mb-4">
              <p className="text-gray-400">Keine Objekte erkannt</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3 mb-6">
              <table className="w-full border-collapse min-w-full">
                <thead>
                  <tr className="bg-gray-700 text-center">
                    <th className="p-2 text-xs sm:text-sm">ID</th>
                    <th className="p-2 text-xs sm:text-sm">Typ</th>
                    <th className="p-2 text-xs sm:text-sm">Wahrscheinlichkeit</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.map((item, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-center"
                    >
                      <td className="p-2 font-mono text-xs sm:text-sm">{item.id ?? -99}</td>
                      <td className="p-2 text-xs sm:text-sm">
                        {currentClasses[item.class_idx] || `Class ${item.class_idx}`}
                      </td>
                      <td className="p-2 text-xs sm:text-sm">
                        {(item.score * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>)}
          {/* Globale Beerenliste */}
          {globalBerries.classMap?.size !== undefined && (
            <>
              <h3 className="text-gray-300 font-semibold mb-2">Globale Beerenliste</h3>
                <div className="overflow-x-auto -mx-3 px-3">
                  <table className="w-full border-collapse min-w-full">
                    <thead>
                      <tr className="bg-gray-700 text-center">
                        <th className="p-2 text-xs sm:text-sm">Typ</th>
                        <th className="p-2 text-xs sm:text-sm">Anzahl</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* {console.log("Global Berries size:", globalBerries.classMap.size, " Inhalt:", globalBerries)} */}
                      {Array.from(globalBerries.classMap.entries()).map(([classIdx, count]) => (
                        <tr key={classIdx}>
                          <td className="p-2 font-mono text-xs sm:text-sm">
                            {currentClasses[classIdx] || `Class ${classIdx}`}
                          </td>
                          <td className="p-2 text-xs sm:text-sm">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
});

export default ResultsTable;
