"""
Precompute face embeddings from training images using FaceNet (InceptionResnetV1).

- Face detection: MTCNN
- Embedding: InceptionResnetV1 pretrained on VGGFace2
- Data augmentation: original, horizontal flip, brightness/contrast variants
- Output: /models/features.npz with all augmented embeddings
"""

import csv
import os
import glob
import numpy as np
from PIL import Image, ImageEnhance
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1


def get_models(device: str = "cpu"):
    mtcnn = MTCNN(
        image_size=160,
        margin=20,
        min_face_size=40,
        thresholds=[0.6, 0.7, 0.7],
        post_process=True,
        device=device,
        keep_all=False,
    )
    embedder = InceptionResnetV1(pretrained="vggface2").eval().to(device)
    return mtcnn, embedder


def augmentations(face_tensor: torch.Tensor) -> list[torch.Tensor]:
    """
    Generate augmented variants from a face tensor (C, H, W) in [-1, 1].
    Returns list of 5 tensors: original + flip + bright+ + bright- + contrast+.
    """
    variants = [face_tensor]

    # Horizontal flip
    variants.append(torch.flip(face_tensor, dims=[2]))

    # Brightness up (+15%)
    bright_up = torch.clamp(face_tensor * 1.15, -1.0, 1.0)
    variants.append(bright_up)

    # Brightness down (-15%)
    bright_down = torch.clamp(face_tensor * 0.85, -1.0, 1.0)
    variants.append(bright_down)

    # Contrast up: scale around mean
    mean = face_tensor.mean()
    contrast_up = torch.clamp((face_tensor - mean) * 1.2 + mean, -1.0, 1.0)
    variants.append(contrast_up)

    return variants


def load_labels(csv_path: str) -> dict[int, dict]:
    labels = {}
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = int(row["photo_id"])
            labels[pid] = {
                "wage": int(row["wage"]),
                "rank": int(row["rank"]),
                "style": row.get("style", ""),
            }
    return labels


def find_images(training_dir: str, photo_id: int) -> list[str]:
    folder_names = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]
    images = []
    for folder in folder_names:
        pattern = os.path.join(training_dir, "**", folder, f"{photo_id}.jpg")
        images.extend(glob.glob(pattern, recursive=True))
    return images


@torch.no_grad()
def main():
    training_dir = os.environ.get("TRAINING_DIR", "/training-data")
    model_dir = os.environ.get("MODEL_DIR", "/models")
    csv_path = os.path.join(training_dir, "labels.csv")

    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} not found")
        return

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    print("Loading FaceNet (MTCNN + InceptionResnetV1 VGGFace2)...")
    mtcnn, embedder = get_models(device)

    print("Loading labels...")
    labels = load_labels(csv_path)
    print(f"  Found {len(labels)} labeled entries")

    all_features = []
    all_ranks = []
    all_wages = []
    all_ids = []

    face_found = 0
    face_missed = 0

    print("Extracting FaceNet embeddings with augmentation...")
    for pid, info in sorted(labels.items()):
        images = find_images(training_dir, pid)
        if not images:
            print(f"  WARNING: No images found for photo_id={pid}")
            continue

        for img_path in images:
            try:
                img = Image.open(img_path).convert("RGB")
                face_tensor = mtcnn(img)

                if face_tensor is None:
                    face_missed += 1
                    continue
                face_found += 1

                # Generate augmented variants
                variants = augmentations(face_tensor)

                # Batch embed all variants
                batch = torch.stack(variants).to(device)
                embeddings = embedder(batch).cpu().numpy()

                # L2 normalize each
                for emb in embeddings:
                    emb = emb / (np.linalg.norm(emb) + 1e-8)
                    all_features.append(emb)
                    all_ranks.append(info["rank"])
                    all_wages.append(info["wage"])
                    all_ids.append(pid)

            except Exception as e:
                print(f"  ERROR processing {img_path}: {e}")

    print(f"  Face detected: {face_found}, missed: {face_missed}")

    if not all_features:
        print("ERROR: No features extracted")
        return

    features = np.stack(all_features).astype(np.float32)
    ranks = np.array(all_ranks, dtype=np.int32)
    wages = np.array(all_wages, dtype=np.int32)
    ids = np.array(all_ids, dtype=np.int32)

    os.makedirs(model_dir, exist_ok=True)
    output_path = os.path.join(model_dir, "features.npz")
    np.savez(output_path, features=features, ranks=ranks, wages=wages, ids=ids)
    print(f"Saved {len(features)} embeddings to {output_path}")
    print(f"  Unique persons: {len(set(ids.tolist()))}")
    print(f"  Avg embeddings per person: {len(features) / max(1, len(set(ids.tolist()))):.1f}")
    print(f"  Rank distribution: {dict(zip(*np.unique(ranks, return_counts=True)))}")


if __name__ == "__main__":
    main()
