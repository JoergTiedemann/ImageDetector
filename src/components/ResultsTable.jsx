import { memo } from "react";

const ResultsTable = memo(function ResultsTable({ details, currentClasses,currentImageIndex }) {
  const bildanalyse = details?.bildanalyse ?? 0;
  const detections = details?.frameDetections || [];
  const uniqueCount = details?.uniqueBerryCount ?? 0;
  const globalBerries = details?.globalBerryInfo || [];
  // console.log("ResultsTable - Details:", details);
  var global_reif = 0;
  var global_unreif =  0;
  var global_mittelreif = 0;
  var global_sum = 0;
  var reif_percent = 0;

  if (bildanalyse == 0){
    // wir zeigen die Ergebnisse des laufenden Kamerastreams an
    global_sum = uniqueCount;
    global_reif = details?.reifCount ?? 0;
    global_unreif = details?.unreifCount ?? 0;
    global_mittelreif = details?.halbReifCount ?? 0;
    reif_percent = global_sum > 0 ? Math.round((global_reif / global_sum) * 100) : 0;
  }
  else
  {
    if (details.globalBerryInfo) {
      if ((bildanalyse > 0) &&  details.globalBerryInfo.classMap) {
        global_reif = details.globalBerryInfo.classMap.get(0)?? 0;
        global_unreif = details.globalBerryInfo.classMap.get(2)?? 0;
        global_mittelreif = details.globalBerryInfo.classMap.get(1)?? 0;
      }
      else if (bildanalyse > 0) {
        global_reif = details.globalBerryInfo[0] ?? 0;
        global_unreif = details.globalBerryInfo[2] ?? 0;
        global_mittelreif = details.globalBerryInfo[1] ?? 0;
      }
      global_sum = global_reif + global_unreif + global_mittelreif;
      reif_percent = global_sum > 0 ? Math.round((global_reif / global_sum) * 100) : 0;
    }
  }
  /* als erstes die Summentitelzeile  */
  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
      <details className="text-gray-200 group">
        <summary className="flex items-center cursor-pointer select-none">
          <div className="flex-1 text-lg sm:text-xl font-bold border-b border-gray-700 pb-2">
          {`Reif:${global_reif} (${reif_percent}%) - Mittelreif:${global_mittelreif} - Unreif:${global_unreif}`}
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

        {/* hier kommt die Detailliste */}
        <div className="transition-all duration-300 ease-in-out transform origin-top group-open:animate-details-show mt-3 sm:mt-4">
          {/* Frame-Detektionen */}
          {bildanalyse === 0  && (
          <>
          <h3 className="text-gray-300 font-semibold mb-2">Reifegradprognose</h3>
            <div className="overflow-x-auto -mx-3 px-3 mb-6">
              <table className="w-full border-collapse min-w-full">
                <thead>
                  <tr className="bg-gray-700 text-center">
                    <th className="p-2 text-xs sm:text-sm">Anzahl</th>
                    <th className="p-2 text-xs sm:text-sm">Typ</th>
                  </tr>
                </thead>
                <tbody>
                    <tr className="border-b border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-center">
                      <td className="p-2 font-mono text-xs sm:text-sm"> 
                        {global_reif}
                      </td>
                      <td className="p-2 text-xs sm:text-sm">
                        {currentClasses[0] || `Class ${0}`}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-center">
                      <td className="p-2 font-mono text-xs sm:text-sm"> 
                        {global_mittelreif}
                      </td>
                      <td className="p-2 text-xs sm:text-sm">
                        {currentClasses[1] || `Class ${1}`}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 text-center">
                      <td className="p-2 font-mono text-xs sm:text-sm"> 
                        {global_unreif}
                      </td>
                      <td className="p-2 text-xs sm:text-sm">
                         {currentClasses[2] || `Class ${2}`} 
                      </td>
                    </tr>
                </tbody>
              </table>
            </div>
          </>)}
          {/* Globale Beerenliste */}
          {bildanalyse > 0 && (
            <>
              <h3 className="text-gray-300 font-semibold mb-2">Bildanalyse</h3>
                <div className="overflow-x-auto -mx-3 px-3">
                  <table className="w-full border-collapse min-w-full">
                    <thead>
                        <tr className="bg-gray-700 text-center">
                          <th className="p-2 text-xs sm:text-sm">Bild</th>
                          <th className="p-2 text-xs sm:text-sm">Reifegrad</th>
                          <th className="p-2 text-xs sm:text-sm">Anzahl</th>
                        </tr>
                    </thead>
                    <tbody>
                      {/* Neue Ansicht: Stückzahlen pro class_idx und imageIndex */}
                      {(() => {
                        // Gruppiere detections nach imageIndex und class_idx
                        const grouped = {};
                        const totals = {};
                        detections.forEach((item) => {
                          const imgIdx = item.imageIndex ?? 0;
                          const clsIdx = item.class_idx ?? -1;
                          if (!grouped[imgIdx]) grouped[imgIdx] = {};
                          if (!grouped[imgIdx][clsIdx]) grouped[imgIdx][clsIdx] = 0;
                          grouped[imgIdx][clsIdx] += 1;
                          if (!totals[imgIdx]) totals[imgIdx] = 0;
                          totals[imgIdx] += 1;
                        });
                        // Erzeuge Zeilen: für jeden imageIndex und class_idx
                        return Object.entries(grouped).map(([imgIdx, classCounts]) => (
                          Object.entries(classCounts).map(([clsIdx, count]) => {
                            const total = totals[imgIdx] || 1;
                            const percent = ((count / total) * 100).toFixed(0);
                            return (
                              <tr
                                key={imgIdx + '-' + clsIdx}
                                className={
                                  "border-b border-gray-700 transition-colors text-center " +
                                  (parseInt(imgIdx) === (currentImageIndex + 1)
                                    ? "text-green-300 hover:text-green-200"
                                    : "text-gray-300 hover:bg-gray-700")
                                }
                              >
                                <td className="p-2 font-mono text-xs sm:text-sm">{imgIdx}</td>
                                <td className="p-2 text-xs sm:text-sm">{currentClasses[clsIdx] || `Class ${clsIdx}`}</td>
                                <td className="p-2 text-xs sm:text-sm">{count} / {percent}%</td>
                              </tr>
                            );
                          })
                        ));
                      })()}
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
