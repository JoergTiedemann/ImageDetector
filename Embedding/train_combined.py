import torch
from torch.utils.data import DataLoader
import random
import sys
import os
import torchvision.transforms as T

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.combined_model import CombinedModel
from dataset import CropDataset


# Triplet Loss
def triplet_loss(anchor, positive, negative, margin=1.0):
    d_pos = torch.norm(anchor - positive, dim=1)
    d_neg = torch.norm(anchor - negative, dim=1)
    return torch.clamp(d_pos - d_neg + margin, min=0).mean()


# Collate-Funktion für variable Crop-Anzahl
def collate_variable(batch):
    crops_list = []
    labels_list = []
    for crops, labels in batch:
        crops_list.append(crops)
        labels_list.append(labels)
    return crops_list, labels_list


# Augmentation für Positive Samples
augment = T.Compose([
    T.RandomRotation(10),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
    T.RandomResizedCrop(128, scale=(0.8, 1.0)),
])


def main():
    dataset = CropDataset(
        img_dir="data/train/images",
        label_dir="data/train/labels",
        size=128
    )

    loader = DataLoader(
        dataset,
        batch_size=4,
        shuffle=True,
        collate_fn=collate_variable
    )

    model = CombinedModel(
        "best9k_100.pt",
        crop_size=128,
        embedding_dim=128
    )

    optimizer = torch.optim.Adam(model.embed.parameters(), lr=1e-3)

    epochs = 10

    for epoch in range(epochs):
        epoch_losses = []
        batch_counter = 0

        for crops_batch, labels_batch in loader:
            batch_counter += 1
            print(".", end="", flush=True)
            if batch_counter % 50 == 0:
                    print(f"  processed {batch_counter} batches...")

            B = len(crops_batch)

            for i in range(B):
                crops = crops_batch[i]
                labels = labels_batch[i]

                num = len(crops)
                if num < 2:
                    continue

                # Anchor wählen
                idx_anchor = random.randint(0, num - 1)
                anchor = crops[idx_anchor]

                # Positive = augmentierter Anchor
                positive = augment(anchor)

                # Negative = andere Beere im selben Bild
                neg_candidates = [j for j in range(num) if j != idx_anchor]

                if len(neg_candidates) == 0:
                    continue

                idx_negative = random.choice(neg_candidates)
                negative = crops[idx_negative]

                # Embeddings berechnen
                emb_anchor = model.embed(anchor.unsqueeze(0))
                emb_positive = model.embed(positive.unsqueeze(0))
                emb_negative = model.embed(negative.unsqueeze(0))

                # Loss
                loss = triplet_loss(emb_anchor, emb_positive, emb_negative)

                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                epoch_losses.append(loss.item())

        print()  # neue Zeile nach Punkten

        if len(epoch_losses) == 0:
            print(f"Epoch {epoch+1}: keine gültigen Triplets gefunden")
            continue

        avg_loss = sum(epoch_losses) / len(epoch_losses)
        print(f"Epoch {epoch+1}/{epochs}  Avg Loss: {avg_loss:.4f}")

    torch.save(model.embed.state_dict(), "embedding9k_100.pt")
    print("Training abgeschlossen. embedding9k_100.pt gespeichert.")


if __name__ == "__main__":
    main()