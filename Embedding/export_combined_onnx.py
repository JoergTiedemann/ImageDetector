import torch
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.combined_model import CombinedModel


model = CombinedModel(
    "best9k_100.pt",
    crop_size=128,
    embedding_dim=128
)

# Embedding-Netz laden
model.embed.load_state_dict(torch.load("embedding9k_100.pt"))
model.embed.eval()

dummy = torch.randn(1, 3, 128, 128)

torch.onnx.export(
    model.embed,
    dummy,
    "embedding9k_100.onnx",
    input_names=["input"],
    output_names=["embedding"],
    opset_version=18
)
