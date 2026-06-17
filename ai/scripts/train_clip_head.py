"""
Train a small MLP regression head on top of CLIP ViT-L/14 image embeddings.

Phase 1 of the upgrade plan. Designed to be run on Colab/Kaggle with a free GPU
(no proprietary code, no special hardware). Saves a `.pt` artifact that the
serving engine (`ai/engines/clip_v1.py`) can blend with k-NN voting via the
`RANKME_HEAD_BLEND` env var.

Supported training datasets:
- SCUT-FBP5500 (1..5 → linearly rescaled to 1..10)
- In-house exported corrections (JSONL from `/api/admin/corrections?format=jsonl&include=embedding`)
- Any combination of both

Typical Colab usage:

    !pip install transformers facenet-pytorch torch torchvision numpy pillow
    !python train_clip_head.py \\
        --scut-images /content/SCUT-FBP5500_v2/Images \\
        --scut-ratings /content/SCUT-FBP5500_v2/train_test_files/All_labels.txt \\
        --out clip_head.pt

The output `.pt` file should be uploaded to the HF Space (`/models/clip_head.pt`)
alongside `features_clip.npz`.
"""

from __future__ import annotations

import argparse
import json
import base64
import os
import sys
import time
from typing import Optional

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset
from PIL import Image


# --------------------------------------------------------------------------
# Same MLP architecture as `ai/engines/clip_v1.py:_ClipRegressionHead`.
# Keep them in sync — duplicated here so this script has no runtime dependency
# on the serving code (so it can run in a clean Colab kernel).
# --------------------------------------------------------------------------
class ClipRegressionHead(torch.nn.Module):
    def __init__(self, emb_dim: int = 768, hidden: int = 256):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Linear(emb_dim, hidden),
            torch.nn.GELU(),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(hidden, hidden // 2),
            torch.nn.GELU(),
            torch.nn.Linear(hidden // 2, 1),
        )

    def forward(self, x):
        raw = self.net(x).squeeze(-1)
        return 1.0 + 9.0 * torch.sigmoid(raw)


def _l2_normalize(x: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(x, axis=-1, keepdims=True) + 1e-8
    return (x / n).astype(np.float32)


# --------------------------------------------------------------------------
# Dataset loaders
# --------------------------------------------------------------------------

def load_scut_fbp5500(
    images_dir: str,
    ratings_file: str,
    device: str = "cuda",
) -> tuple[np.ndarray, np.ndarray]:
    """Return (embeddings [N, 768], scores [N] in 1..10) for SCUT-FBP5500.

    Embeddings are produced by running each image through OpenAI CLIP ViT-L/14.
    Scores from the dataset are 1..5; we linearly rescale to 1..10 so the head
    output range matches Rankme's serving range.
    """
    from transformers import CLIPModel, CLIPProcessor
    from facenet_pytorch import MTCNN

    print(f"Loading CLIP on {device}...")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
    clip = CLIPModel.from_pretrained("openai/clip-vit-large-patch14").eval().to(device)
    mtcnn = MTCNN(image_size=224, margin=20, min_face_size=40, device=device, keep_all=False)

    pairs: list[tuple[str, float]] = []
    with open(ratings_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            name, score = parts[0], parts[1]
            try:
                pairs.append((name, float(score)))
            except ValueError:
                continue
    print(f"  Loaded {len(pairs)} (name, score) pairs from {ratings_file}")

    embs: list[np.ndarray] = []
    ys: list[float] = []
    t0 = time.time()
    with torch.no_grad():
        for i, (name, score) in enumerate(pairs):
            path = os.path.join(images_dir, name)
            if not os.path.exists(path):
                # SCUT-FBP5500 ratings file occasionally references missing files.
                continue
            try:
                img = Image.open(path).convert("RGB")
                face = mtcnn(img)
                if face is None:
                    # Fallback to whole image — CLIP still gives a usable embedding,
                    # and SCUT-FBP5500 portraits are tight enough that this is fine.
                    pil = img.resize((224, 224))
                else:
                    u8 = ((face.clamp(-1.0, 1.0) + 1.0) * 127.5).to(torch.uint8)
                    np_img = u8.cpu().numpy().transpose(1, 2, 0)
                    pil = Image.fromarray(np_img, mode="RGB")
                inputs = processor(images=pil, return_tensors="pt").to(device)
                emb = clip.get_image_features(**inputs).cpu().numpy()[0]
                emb = emb / (np.linalg.norm(emb) + 1e-8)
                embs.append(emb.astype(np.float32))
                # 1..5 → 1..10 (linear rescale; 1→1, 5→10)
                ys.append(1.0 + (score - 1.0) * (9.0 / 4.0))
            except Exception as e:
                print(f"  skipping {path}: {e}")
            if (i + 1) % 200 == 0:
                rate = (i + 1) / (time.time() - t0)
                print(f"  {i+1}/{len(pairs)} encoded ({rate:.1f} img/s)")
    if not embs:
        raise RuntimeError("No SCUT-FBP5500 embeddings produced")
    return np.stack(embs), np.asarray(ys, dtype=np.float32)


def load_corrections_jsonl(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Read corrections.jsonl with embedded `embeddingB64` rows.

    Output (embeddings [N, 768], scores [N] in 1..10). Rows without embedding are
    skipped silently so this is safe to combine with future schema additions.
    """
    embs: list[np.ndarray] = []
    ys: list[float] = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            b64 = row.get("embeddingB64")
            corrected = row.get("correctedRank")
            if not b64 or corrected is None:
                continue
            buf = base64.b64decode(b64)
            arr = np.frombuffer(buf, dtype=np.float32)
            if arr.size == 0:
                continue
            emb = arr / (np.linalg.norm(arr) + 1e-8)
            embs.append(emb.astype(np.float32))
            ys.append(float(corrected))
    if not embs:
        raise RuntimeError(f"No rows with embeddingB64 found in {path}")
    return np.stack(embs), np.asarray(ys, dtype=np.float32)


# --------------------------------------------------------------------------
# Training loop
# --------------------------------------------------------------------------

def train(
    X: np.ndarray,
    y: np.ndarray,
    out_path: str,
    *,
    epochs: int = 30,
    batch_size: int = 64,
    lr: float = 1e-3,
    val_fraction: float = 0.1,
    device: str = "cuda",
    seed: int = 0,
) -> None:
    rng = np.random.default_rng(seed)
    perm = rng.permutation(len(X))
    X = X[perm]
    y = y[perm]

    n_val = max(1, int(len(X) * val_fraction))
    X_train, X_val = X[n_val:], X[:n_val]
    y_train, y_val = y[n_val:], y[:n_val]
    print(f"Train/Val split: {len(X_train)} / {len(X_val)}")

    train_ds = TensorDataset(
        torch.from_numpy(X_train).float(),
        torch.from_numpy(y_train).float(),
    )
    val_ds = TensorDataset(
        torch.from_numpy(X_val).float(),
        torch.from_numpy(y_val).float(),
    )
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    emb_dim = int(X.shape[1])
    head = ClipRegressionHead(emb_dim=emb_dim).to(device)
    opt = torch.optim.AdamW(head.parameters(), lr=lr, weight_decay=1e-4)
    loss_fn = torch.nn.SmoothL1Loss()  # robust to label noise

    best_val = float("inf")
    best_state = None

    for ep in range(1, epochs + 1):
        head.train()
        tr_loss = 0.0
        for xb, yb in train_loader:
            xb = xb.to(device)
            yb = yb.to(device)
            pred = head(xb)
            loss = loss_fn(pred, yb)
            opt.zero_grad()
            loss.backward()
            opt.step()
            tr_loss += loss.item() * xb.size(0)
        tr_loss /= len(train_ds)

        head.eval()
        with torch.no_grad():
            preds = []
            ys = []
            v_loss = 0.0
            for xb, yb in val_loader:
                xb = xb.to(device)
                yb = yb.to(device)
                p = head(xb)
                v_loss += loss_fn(p, yb).item() * xb.size(0)
                preds.append(p.cpu().numpy())
                ys.append(yb.cpu().numpy())
            v_loss /= max(1, len(val_ds))
            preds_np = np.concatenate(preds)
            ys_np = np.concatenate(ys)
            # Pearson correlation as a quick sanity check
            if preds_np.std() > 1e-6:
                pearson = float(np.corrcoef(preds_np, ys_np)[0, 1])
            else:
                pearson = 0.0

        print(f"  ep {ep:>2}: train {tr_loss:.4f}  val {v_loss:.4f}  pearson {pearson:.3f}")

        if v_loss < best_val:
            best_val = v_loss
            best_state = {k: v.detach().cpu().clone() for k, v in head.state_dict().items()}

    if best_state is None:
        best_state = {k: v.detach().cpu().clone() for k, v in head.state_dict().items()}

    # Pack metadata alongside the state dict so the serving code can verify the
    # embedding dimension matches the running CLIP backbone.
    artifact = {
        "state_dict": best_state,
        "emb_dim": int(X.shape[1]),
        "rank_range": [1, 10],
        "trained_on": [
            ("scut", int(len(X))),
        ],
    }
    torch.save(artifact, out_path)
    print(f"Saved {out_path} (best val loss {best_val:.4f})")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--scut-images", help="Path to SCUT-FBP5500 Images dir")
    p.add_argument("--scut-ratings", help="Path to All_labels.txt (image-name + score per line)")
    p.add_argument("--corrections", help="Path to corrections.jsonl (with embeddingB64)")
    p.add_argument("--out", default="clip_head.pt", help="Output .pt path")
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--val-fraction", type=float, default=0.1)
    p.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    return p.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    Xs: list[np.ndarray] = []
    ys: list[np.ndarray] = []

    if args.scut_images and args.scut_ratings:
        X, y = load_scut_fbp5500(args.scut_images, args.scut_ratings, device=args.device)
        print(f"SCUT-FBP5500: {len(X)} samples")
        Xs.append(X)
        ys.append(y)

    if args.corrections:
        X, y = load_corrections_jsonl(args.corrections)
        print(f"Corrections jsonl: {len(X)} samples")
        Xs.append(X)
        ys.append(y)

    if not Xs:
        print("ERROR: provide --scut-images + --scut-ratings and/or --corrections", file=sys.stderr)
        return 2

    X_all = np.concatenate(Xs, axis=0)
    y_all = np.concatenate(ys, axis=0)
    print(f"Total samples: {len(X_all)}")

    train(
        X_all,
        y_all,
        out_path=args.out,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        val_fraction=args.val_fraction,
        device=args.device,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
