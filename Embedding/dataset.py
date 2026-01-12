import os
import torch
from torch.utils.data import Dataset
from PIL import Image
import numpy as np

class CropDataset(Dataset):
    def __init__(self, img_dir, label_dir, size=128):
        self.img_dir = img_dir
        self.label_dir = label_dir
        self.size = size

        self.images = sorted(os.listdir(img_dir))

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_name = self.images[idx]
        img_path = os.path.join(self.img_dir, img_name)
        label_path = os.path.join(self.label_dir, img_name.replace(".jpg", ".txt"))

        img = Image.open(img_path).convert("RGB")
        w, h = img.size

        crops = []
        labels = []

        with open(label_path) as f:
            for line in f:
                parts = line.split()

                # YOLOv8: first 5 values = class + bbox
                cls = float(parts[0])
                x = float(parts[1])
                y = float(parts[2])
                bw = float(parts[3])
                bh = float(parts[4])

                cx = x * w
                cy = y * h
                bw = bw * w
                bh = bh * h

                x1 = int(cx - bw/2)
                y1 = int(cy - bh/2)
                x2 = int(cx + bw/2)
                y2 = int(cy + bh/2)

                crop = img.crop((x1, y1, x2, y2)).resize((self.size, self.size))

                crop = np.array(crop)              # PIL → NumPy
                crop = torch.tensor(crop)          # NumPy → Tensor
                crop = crop.permute(2,0,1).float() / 255.0

                crops.append(crop)
                labels.append(idx)

        return torch.stack(crops), torch.tensor(labels)