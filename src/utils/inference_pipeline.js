import cv from "@techstark/opencv-js";
import { preProcess_img, applyNMS, Colors } from "./img_preprocess";

/**
 * Inference pipeline for YOLO model.
 * @param {HTMLImageElement|HTMLCanvasElement|OffscreenCanvas} imageSource - Input image source
 * @param {ort.InferenceSession} session - YOLO model ort session.
 * @param {[Number, Number]} overlay_size - Overlay width and height. [width, height]
 * @param {object} model_config - Model configuration object.
 * @returns {[object, string]} Tuple containing:
 *   - First element: object with inference results:
 *     - bbox_results: Array<Object> - Filtered detection results after NMS, each containing:
 *       - bbox: [x, y, width, height] in original image coordinates
 *       - class_idx: Predicted class index
 *       - score: Confidence score (0-1)
 *       - keypoints?:  For pose tasks: [{x, y, score}] for each keypoint
 *       - mask_weights?: For segmentation tasks: mask coefficients
 *     - mask_imgData?: For segmentation tasks: RGBA overlay image with colored masks
 *   - Second element: Inference time in milliseconds (formatted to 2 decimal places)
 *
 */
export async function inference_pipeline(
  imageSource,
  session,
  overlay_size,
  model_config
) {
  try {
    // console.log("Image source:", imageSource," Session:",session," Overlay size:",overlay_size," Model config:",model_config);
    // Read DOM to cv.Mat
    const src_mat = cv.imread(imageSource);

    // Pre-process img, inference
    const [input_tensor, xRatio, yRatio] = preProcess_img(
      src_mat,
      overlay_size,
      model_config.imgsz_type
    );
    src_mat.delete();

    const start = performance.now();
    const { output0 } = await session.run({
      images: input_tensor,
    });
    const end = performance.now();
    input_tensor.dispose();

    // Post process
    const results = postProcess_detect(
      output0,
      model_config.score_threshold,
      xRatio,
      yRatio
    );
    output0.dispose();
    // Apply NMS
    const selected_indices = applyNMS(
      results,
      results.map((r) => r.score),
      model_config.iou_threshold
    );
    const filtered_results = selected_indices.map((i) => results[i]);

    return [
      { bbox_results: filtered_results },
      (end - start).toFixed(2),
    ];
  } catch (error) {
    console.error("Inference error:", error);
    return [[], "0.00"];
  }
}

/**
 * Post process detection raw outputs.
 *
 * @param {ort.Tensor} raw_tensor - Yolo model output0
 * @param {number} score_threshold - Score threshold
 * @param {number} xRatio - xRatio
 * @param {number} yRatio - yRatio
 * @returns {Array<Object>} Array of object detection results. Each item:
 * - bbox: [number, number, number, number]
 */
function postProcess_detect(
  raw_tensor,
  score_threshold = 0.45,
  xRatio,
  yRatio
) {
  const NUM_PREDICTIONS = raw_tensor.dims[2];
  const NUM_BBOX_ATTRS = 4;
  const NUM_SCORES = 80;

  const predictions = raw_tensor.data;
  const bbox_data = predictions.subarray(0, NUM_PREDICTIONS * NUM_BBOX_ATTRS);
  const scores_data = predictions.subarray(NUM_PREDICTIONS * NUM_BBOX_ATTRS);

  const results = new Array();
  let resultCount = 0;

  for (let i = 0; i < NUM_PREDICTIONS; i++) {
    let maxScore = 0;
    let class_idx = -1;

    for (let c = 0; c < NUM_SCORES; c++) {
      const score = scores_data[i + c * NUM_PREDICTIONS];
      if (score > maxScore) {
        maxScore = score;
        class_idx = c;
      }
    }
    if (maxScore <= score_threshold) continue;

    const w = bbox_data[i + NUM_PREDICTIONS * 2] * xRatio;
    const h = bbox_data[i + NUM_PREDICTIONS * 3] * yRatio;
    const tlx = bbox_data[i] * xRatio - 0.5 * w;
    const tly = bbox_data[i + NUM_PREDICTIONS] * yRatio - 0.5 * h;

    results[resultCount++] = {
      bbox: [tlx, tly, w, h],
      class_idx,
      score: maxScore,
    };
  }
  return results;
}



