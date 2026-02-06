import onnx

model = onnx.load("embedding9k_100_single.onnx")
graph = model.graph

print("Inputs:")
for inp in graph.input:
    print(" -", inp.name, inp.type.tensor_type.shape)

print("\nOutputs:")
for out in graph.output:
    print(" -", out.name, out.type.tensor_type.shape)