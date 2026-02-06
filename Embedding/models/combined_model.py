import torch
import torch.nn as nn
import torch.nn.functional as F
from ultralytics import YOLO
from models.embedding_net import EmbeddingNet


def bbox_to_grid(bboxes, H, W, crop_size):
    """
    bboxes: [N, 4] in xyxy format (absolute pixel coords)
    returns sampling grid for grid_sample
    """
    N = bboxes.shape[0]

    # Normalize to [-1, 1]
    x1 = bboxes[:, 0] / (W - 1) * 2 - 1
    y1 = bboxes[:, 1] / (H - 1) * 2 - 1
    x2 = bboxes[:, 2] / (W - 1) * 2 - 1
    y2 = bboxes[:, 3] / (H - 1) * 2 - 1

    # Create grid for each crop
    xs = torch.linspace(0, 1, crop_size).unsqueeze(0).repeat(crop_size, 1)
    ys = torch.linspace(0, 1, crop_size).unsqueeze(1).repeat(1, crop_size)

    xs = xs.unsqueeze(0).repeat(N, 1, 1)
    ys = ys.unsqueeze(0).repeat(N, 1, 1)

    grid_x = x1.unsqueeze(1).unsqueeze(2) * (1 - xs) + x2.unsqueeze(1).unsqueeze(2) * xs
    grid_y = y1.unsqueeze(1).unsqueeze(2) * (1 - ys) + y2.unsqueeze(1).unsqueeze(2) * ys

    grid = torch.stack([grid_x, grid_y], dim=-1)
    return grid


class CombinedModel(nn.Module):
    def __init__(self, yolo_path="yolov8n.pt", crop_size=128, embedding_dim=128):
        super().__init__()

        self.yolo = YOLO(yolo_path).model
        self.embed = EmbeddingNet(embedding_dim)
        self.crop_size = crop_size

    def forward(self, x):
        # YOLOv8 forward
        det = self.yolo(x)[0]  # raw output

        # Extract bounding boxes (xyxy)
        bboxes = det[:, :4]  # shape [N, 4]

        if bboxes.shape[0] == 0:
            # No detections → return empty embedding
            empty = torch.zeros(0, 128)
            return det, empty

        B, C, H, W = x.shape

        # Build sampling grid
        grid = bbox_to_grid(bboxes, H, W, self.crop_size)

        # grid_sample expects [B, C, H, W] and grid [N, Hc, Wc, 2]
        crops = F.grid_sample(
            x.repeat(bboxes.shape[0], 1, 1, 1),
            grid,
            mode="bilinear",
            align_corners=True
        )

        # Embeddings
        embeddings = self.embed(crops)

        return det, embeddings