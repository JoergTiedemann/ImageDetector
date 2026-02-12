import torch
from ultralytics import YOLO

# Modell laden
model = YOLO('runs/detect/train5/weights/best.pt')

# Nur die Gewichte extrahieren
torch.save(model.model.state_dict(), 'best_weights.pt')
print("✅ best_weights.pt erfolgreich gespeichert.")