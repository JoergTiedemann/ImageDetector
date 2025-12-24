import React, { useState } from "react";
import { detectBerries } from "./yolo";

export default function App() {
  const [image, setImage] = useState(null);
  const [boxes, setBoxes] = useState([]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImage(url);
      setBoxes([]); // reset
    }
  };

  const runDetection = async () => {
    if (!image) return;
    const img = new Image();
    img.src = image;
    img.onload = async () => {
      const results = await detectBerries(img);
      setBoxes(results);
    };
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>YOLOv8 ONNX Demo</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <button onClick={runDetection} disabled={!image}>
        Detect
      </button>

      {image && (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={image} alt="upload" style={{ maxWidth: "640px" }} />
          {boxes.map((box, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                border: "2px solid red",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  background: "red",
                  color: "white",
                  fontSize: "12px",
                  padding: "2px",
                  position: "absolute",
                  top: "-1.5em",
                  left: 0,
                }}
              >
                {box.label} ({box.score.toFixed(2)})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}