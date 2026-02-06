import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import torch
import onnx

# ---------------------------------------------------------
# 1. Dein CombinedModel importieren
# ---------------------------------------------------------
from models.combined_model import CombinedModel

# ---------------------------------------------------------
# 2. Modell initialisieren
# ---------------------------------------------------------
model = CombinedModel(
    "best9k_100.pt",
    crop_size=128,
    embedding_dim=128
)

# Embedding-Netz laden
state = torch.load("embedding9k_100.pt", map_location="cpu")
model.embed.load_state_dict(state)
model.embed.eval()

# Dummy Input
dummy = torch.randn(1, 3, 128, 128)

# ---------------------------------------------------------
# 3. ONNX Export (kann .onnx.data erzeugen)
# ---------------------------------------------------------
onnx_path = "embedding9k_100.onnx"

print("Exportiere ONNX...")
torch.onnx.export(
    model.embed,
    dummy,
    onnx_path,
    input_names=["input"],
    output_names=["embedding"],
    opset_version=18,
    export_params=True,
    keep_initializers_as_inputs=False
)

print("ONNX exportiert:", onnx_path)

# ---------------------------------------------------------
# 4. ONNX + External Data zusammenführen
# ---------------------------------------------------------
merged_path = "embedding9k_100_single.onnx"

print("Führe externe Daten zusammen...")
model_onnx = onnx.load(onnx_path, load_external_data=True)
onnx.save(model_onnx, merged_path, save_as_external_data=False)

print("FERTIG! Browser-kompatibles Modell erzeugt:")
print(" →", merged_path)