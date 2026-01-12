import torch
from models.embedding_net import EmbeddingNet

model = EmbeddingNet()
model.load_state_dict(torch.load("embedding_net.pt"))
model.eval()

dummy = torch.randn(1, 3, 128, 128)

torch.onnx.export(
    model,
    dummy,
    "embedding_net.onnx",
    input_names=["input"],
    output_names=["embedding"],
    opset_version=12
)