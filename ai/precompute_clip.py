"""
Precompute CLIP ViT-L/14 face embeddings from training images.

CLIP analogue of `ai/precompute.py`. Same folder convention (①〜⑩) so the
ground-truth ranks come from the directory layout, not the CSV. CSV is read
only for the rank→wage averages.

- Face detection: MTCNN (same as the legacy pipeline so the subject region
  matches what the serving engine will see at request time).
- Embedding: OpenAI CLIP ViT-L/14 image encoder via `transformers`.
- Augmentation: original + horizontal flip + brightness +/- + contrast+ (5x).
  Augmenting CLIP embeddings increases robustness to lighting differences in
  user uploads without changing semantic content.
- Output: `/models/features_clip.npz`.

Run:
    python ai/precompute_clip.py        # reads /training-data, writes /models
    TRAINING_DIR=./training-data MODEL_DIR=./models python ai/precompute_clip.py
"""

from __future__ import annotations

import csv
import os
import re
import numpy as np
from PIL import Image
import torch
from facenet_pytorch import MTCNN
from transformers import CLIPModel, CLIPProcessor


CIRCLED_TO_RANK = {
    "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5,
    "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
}

# Same fallback table as legacy precompute so wage outputs stay comparable.
DEFAULT_WAGE_BY_RANK = {
    1: 10000, 2: 15000, 3: 18000, 4: 20000, 5: 25000,
    6: 28000, 7: 30000, 8: 35000, 9: 38000, 10: 40000,
}

CLIP_MODEL_ID = os.environ.get("RANKME_CLIP_MODEL", "openai/clip-vit-large-patch14")


def get_face_detector(device: str = "cpu") -> MTCNN:
    return MTCNN(
        image_size=224,
        margin=20,
        min_face_size=40,
        thresholds=[0.6, 0.7, 0.7],
        post_process=True,
        device=device,
        keep_all=False,
    )


def get_clip(device: str = "cpu"):
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
    model = CLIPModel.from_pretrained(CLIP_MODEL_ID).eval().to(device)
    return processor, model


def augmentations(face_tensor: torch.Tensor) -> list[torch.Tensor]:
    """Same 5-way augmentation as the legacy precompute, but on a 224x224 crop."""
    variants = [face_tensor]
    variants.append(torch.flip(face_tensor, dims=[2]))
    variants.append(torch.clamp(face_tensor * 1.15, -1.0, 1.0))
    variants.append(torch.clamp(face_tensor * 0.85, -1.0, 1.0))
    mean = face_tensor.mean()
    variants.append(torch.clamp((face_tensor - mean) * 1.2 + mean, -1.0, 1.0))
    return variants


def rank_from_path(path: str) -> int | None:
    parts = re.split(r"[\\/]", path)
    for seg in parts:
        for ch in seg:
            if ch in CIRCLED_TO_RANK:
                return CIRCLED_TO_RANK[ch]
    return None


def load_wage_by_rank(csv_path: str) -> dict[int, int]:
    if not os.path.exists(csv_path):
        print(f"  labels.csv not found at {csv_path}; using DEFAULT_WAGE_BY_RANK")
        return dict(DEFAULT_WAGE_BY_RANK)
    sums: dict[int, int] = {}
    counts: dict[int, int] = {}
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                r = int(row["rank"])
                w = int(row["wage"])
            except (KeyError, ValueError):
                continue
            sums[r] = sums.get(r, 0) + w
            counts[r] = counts.get(r, 0) + 1
    out: dict[int, int] = {}
    for r in range(1, 11):
        out[r] = int(round(sums[r] / counts[r])) if counts.get(r) else DEFAULT_WAGE_BY_RANK[r]
    return out


def walk_images(training_dir: str) -> list[tuple[str, int]]:
    out: list[tuple[str, int]] = []
    for root, dirs, files in os.walk(training_dir):
        dirs.sort()
        rank = rank_from_path(os.path.relpath(root, training_dir))
        if rank is None:
            continue
        for name in sorted(files):
            if name.startswith("."):
                continue
            if not name.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            out.append((os.path.join(root, name), rank))
    out.sort(key=lambda x: (x[1], x[0]))
    return out


@torch.no_grad()
def main():
    training_dir = os.environ.get("TRAINING_DIR", "/training-data")
    model_dir = os.environ.get("MODEL_DIR", "/models")
    csv_path = os.path.join(training_dir, "labels.csv")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    print(f"Loading CLIP ({CLIP_MODEL_ID})...")
    processor, clip = get_clip(device)
    mtcnn = get_face_detector(device)

    print("Resolving wage table from labels.csv (rank → mean wage)...")
    wage_by_rank = load_wage_by_rank(csv_path)
    for r in range(1, 11):
        print(f"  rank {r:>2}: wage ≈ {wage_by_rank[r]}")

    print(f"Walking {training_dir} for ①〜⑩ folders...")
    items = walk_images(training_dir)
    print(f"  Found {len(items)} images")
    folder_dist: dict[int, int] = {}
    for _, r in items:
        folder_dist[r] = folder_dist.get(r, 0) + 1
    print(f"  Folder rank distribution: {dict(sorted(folder_dist.items()))}")

    all_features: list[np.ndarray] = []
    all_ranks: list[int] = []
    all_wages: list[int] = []
    all_ids: list[int] = []

    face_found = 0
    face_missed = 0
    for img_path, rank in items:
        try:
            img = Image.open(img_path).convert("RGB")
            face_tensor = mtcnn(img)
            if face_tensor is None:
                face_missed += 1
                continue
            face_found += 1

            stem = os.path.splitext(os.path.basename(img_path))[0].strip()
            m = re.match(r"^(\d+)", stem)
            file_idx = int(m.group(1)) if m else 0
            person_id = rank * 100000 + file_idx

            variants = augmentations(face_tensor)
            face_pils: list[Image.Image] = []
            for v in variants:
                u8 = ((v.clamp(-1.0, 1.0) + 1.0) * 127.5).to(torch.uint8)
                np_img = u8.cpu().numpy().transpose(1, 2, 0)
                face_pils.append(Image.fromarray(np_img, mode="RGB"))

            inputs = processor(images=face_pils, return_tensors="pt").to(device)
            embs = clip.get_image_features(**inputs).cpu().numpy()

            wage = wage_by_rank.get(rank, DEFAULT_WAGE_BY_RANK[rank])
            for emb in embs:
                emb = emb / (np.linalg.norm(emb) + 1e-8)
                all_features.append(emb.astype(np.float32))
                all_ranks.append(rank)
                all_wages.append(wage)
                all_ids.append(person_id)
        except Exception as e:
            print(f"  ERROR processing {img_path}: {e}")

    print(f"  Face detected: {face_found}, missed: {face_missed}")

    if not all_features:
        print("ERROR: No CLIP embeddings extracted")
        return

    features = np.stack(all_features).astype(np.float32)
    ranks = np.array(all_ranks, dtype=np.int32)
    wages = np.array(all_wages, dtype=np.int32)
    ids = np.array(all_ids, dtype=np.int32)

    os.makedirs(model_dir, exist_ok=True)
    output_path = os.path.join(model_dir, "features_clip.npz")

    label_source = np.array(f"folder:①-⑩|model:{CLIP_MODEL_ID}", dtype="U")
    np.savez(
        output_path,
        features=features,
        ranks=ranks,
        wages=wages,
        ids=ids,
        label_source=label_source,
    )
    print(f"Saved {len(features)} CLIP embeddings to {output_path}")
    print(f"  Unique persons: {len(set(ids.tolist()))}")
    print(f"  Avg embeddings per person: {len(features) / max(1, len(set(ids.tolist()))):.1f}")
    print(f"  Embedded rank distribution: {dict(zip(*np.unique(ranks, return_counts=True)))}")
    print(f"  Label source: {label_source.item()}")


if __name__ == "__main__":
    main()
