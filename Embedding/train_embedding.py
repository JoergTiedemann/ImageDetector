import torch
from torch import nn
from torch.utils.data import DataLoader
from models.embedding_net import EmbeddingNet
from dataset import CropDataset

def contrastive_loss(a, b, same, margin=1.0):
    dist = torch.norm(a - b, dim=1)
    loss_same = same * dist.pow(2)
    loss_diff = (1 - same) * torch.clamp(margin - dist, min=0).pow(2)
    return (loss_same + loss_diff).mean()

def main():
    dataset = CropDataset("data/train/images", "data/train/labels")
    loader = DataLoader(dataset, batch_size=1, shuffle=True)

    model = EmbeddingNet()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)

    for epoch in range(10):
        for crops, labels in loader:
            crops = crops[0]
            labels = labels[0]

            if len(crops) < 2:
                continue

            a = model(crops[0].unsqueeze(0))
            b = model(crops[1].unsqueeze(0))

            same = torch.tensor([1.0 if labels[0] == labels[1] else 0.0])

            loss = contrastive_loss(a, b, same)

            opt.zero_grad()
            loss.backward()
            opt.step()

        print(f"Epoch {epoch} Loss {loss.item()}")

    torch.save(model.state_dict(), "embedding_net.pt")

if __name__ == "__main__":
    main()