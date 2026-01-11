import { Colors } from "./img_preprocess.js";

/**
 * Draw bounding boxes in overlay canvas based on task type.
 * @param {Array[Object]} predictions - Detection results
 * @param {HTMLCanvasElement} overlay_ctx - Show boxes in overlay canvas element
 * @param {Object} currentClasses - Currently selected classes object
 */
export async function render_overlay(
  predictions,
  overlay_ctx,
  currentClasses
) {
  // Calculate diagonal length of the canvas
  const diagonalLength = Math.sqrt(
    Math.pow(overlay_ctx.canvas.width, 2) +
      Math.pow(overlay_ctx.canvas.height, 2)
  );
  const lineWidth = diagonalLength / 250;

  if (!predictions || predictions.length === 0) return;

  draw_object_detection(
    overlay_ctx,
    predictions,
    lineWidth,
    currentClasses
  );
}

function heatColor(value, max) {
  const ratio = Math.min(value / max, 1);

  if (ratio < 0.33) return "rgba(0, 200, 0, 0.9)";      // grün
  if (ratio < 0.66) return "rgba(255, 165, 0, 0.9)";    // orange
  return "rgba(255, 0, 0, 0.9)";                        // rot
}


export function render_overlaytracked(tracked, ctx, classes) {
  if (!tracked || tracked.length === 0) return;

  ctx.lineWidth = 2;
  ctx.font = "14px Arial";
  ctx.textBaseline = "top";

  tracked.forEach(obj => {
    const [x, y, w, h] = obj.bbox;
    const { id, eDist, pDist, class_idx } = obj;

    // Bounding Box zeichnen
    ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
    ctx.strokeRect(x, y, w, h);

    // Heatmap-Farben
    const eColor = heatColor(eDist, 0.6);   // maxEmbDist
    const pColor = heatColor(pDist, 0.5);   // maxPosDist
    const score = eDist + pDist;
    const scoreColor = heatColor(score, 1.0);

    // Hintergrundbox
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y - 60, 180, 58);

    // Text + Heatmap
    ctx.fillStyle = "white";
    ctx.fillText(`ID: ${id}`, x + 5, y - 58);

    ctx.fillStyle = eColor;
    ctx.fillText(`eDist: ${eDist.toFixed(3)}`, x + 5, y - 42);

    ctx.fillStyle = pColor;
    ctx.fillText(`pDist: ${pDist.toFixed(3)}`, x + 5, y - 26);

    ctx.fillStyle = scoreColor;
    ctx.fillText(`score: ${(score).toFixed(3)}`, x + 5, y - 10);
  });
}



/**
 * Draw object detection results
 */
function draw_object_detection(ctx, predictions, lineWidth, currentClasses) {
  if (!predictions || predictions.length === 0) return;
  const predictionsByClass = {};
  const bbox_predictions = predictions.bbox_results;

  bbox_predictions.forEach((predict) => {
    const classId = predict.class_idx;
    if (!predictionsByClass[classId]) predictionsByClass[classId] = [];
    predictionsByClass[classId].push(predict);
  });

  Object.entries(predictionsByClass).forEach(([classId, items]) => {
    const color = Colors.getColor(Number(classId), 0.2);
    const borderColor = Colors.getColor(Number(classId), 0.8);
    const rgbaFillColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    const rgbaBorderColor = `rgba(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]}, ${borderColor[3]})`;

    ctx.fillStyle = rgbaFillColor;
    items.forEach((predict) => {
      const [x1, y1, width, height] = predict.bbox;
      ctx.fillRect(x1, y1, width, height);
    });

    // draw bounding box
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = rgbaBorderColor;
    items.forEach((predict) => {
      const [x1, y1, width, height] = predict.bbox;
      ctx.strokeRect(x1, y1, width, height);
    });

    // console.log("draw_object_detection CurrentClasses:",currentClasses," ClassId:", classId);
    // draw score text
    ctx.fillStyle = rgbaBorderColor;
    ctx.font = "16px Arial";
    items.forEach((predict) => {
      const [x1, y1] = predict.bbox;
      const text = `${
        currentClasses.classes[predict.class_idx]
      } ${predict.score.toFixed(2)}`;
      drawTextWithBackground(ctx, text, x1, y1);
    });
  });
}



const fontCache = {
  font: "16px Arial",
  measurements: {},
};

function getMeasuredTextWidth(text, ctx) {
  if (!fontCache.measurements[text]) {
    fontCache.measurements[text] = ctx.measureText(text).width;
  }
  return fontCache.measurements[text];
}

/**
 * Helper function to draw text with background
 */
function drawTextWithBackground(ctx, text, x, y) {
  ctx.font = fontCache.font;
  const textWidth = getMeasuredTextWidth(text, ctx);
  const textHeight = 16;

  // Calculate the Y position for the text
  let textY = y - 5;
  let rectY = y - textHeight - 4;

  // Check if the text will be outside the canvas
  if (rectY < 0) {
    // Adjust the Y position to be inside the canvas
    textY = y + textHeight + 5;
    rectY = y + 1;
  }

  const currentFillStyle = ctx.fillStyle;
  ctx.fillRect(x - 1, rectY, textWidth + 4, textHeight + 4);
  ctx.fillStyle = "white";
  ctx.fillText(text, x, textY);
  ctx.fillStyle = currentFillStyle;
}
