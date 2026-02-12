import onnxruntime as ort
import numpy as np

# Modell laden
session = ort.InferenceSession("yolov8n_ultra_tiny.onnx")

# Eingabeinformationen
input_name = session.get_inputs()[0].name
input_shape = session.get_inputs()[0].shape
input_dtype = session.get_inputs()[0].type

print(f"Input name: {input_name}")
print(f"Input shape: {input_shape}")
print(f"Input dtype: {input_dtype}")

# Dummy-Bild erzeugen (1x3x320x320)
dummy_input = np.random.rand(1, 3, 320, 320).astype(np.float32)
#dummy_input = np.random.rand(1, 3, 640, 640).astype(np.float32)

# Inferenz
outputs = session.run(None, {input_name: dummy_input})

# Ausgabe inspizieren
for i, output in enumerate(outputs):
    print(f"Output {i}: shape={output.shape}, dtype={output.dtype}")
