"""
Face attractiveness ranking engine v3 — CLIP ViT-L/14 based.

Phase 1 of the upgrade plan in `docs/research-latest-methods_2026-06-18.md`.

- Face detection: MTCNN (same as similarity_v1; keeps focus on the subject's face
  rather than background pixels CLIP would otherwise weight in).
- Embedding: OpenAI CLIP ViT-L/14 image encoder via `transformers`. Produces a
  768-dim L2-normalized vector that empirically aligns far better with aesthetic
  perception than FaceNet's identity-oriented embedding (see Frontiers AI 2022,
  "CLIP knows image aesthetics").
- Matching: k-NN with cosine similarity + Softmax weighting + bucket vote
  (identical decision logic to similarity_v1 so the system-level behavior — rank
  range, confidence calculation, tie-break — is unchanged). This lets us swap
  the backbone without changing downstream code paths.
- Training data: `features_clip.npz` (built by `ai/precompute_clip.py`).

Optional MLP head: when `clip_head.pt` is present in the model dir, predictions
are blended with a regression head trained on SCUT-FBP5500 (or in-house pairs).
Until the head is trained the engine still works using k-NN voting alone.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

import numpy as np
from PIL import Image
import torch
from facenet_pytorch import MTCNN

from engine_registry import BaseEngine


logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return max(1, int(raw))
    except ValueError:
        return default


# Identical defaults to similarity_v1 so the rank-decision behavior matches.
K_NEIGHBORS = _env_int("RANKME_K_NEIGHBORS", 25)
TEMPERATURE = float(os.environ.get("RANKME_TEMPERATURE", "0.07"))

# CLIP model id. Pinned to ViT-L/14 — the LAION/Stable-Diffusion-era default for
# aesthetic prediction. Overridable via env for experiments.
CLIP_MODEL_ID = os.environ.get("RANKME_CLIP_MODEL", "openai/clip-vit-large-patch14")

# Optional head blending: when present, final continuous rank is
#   (1 - HEAD_BLEND) * knn_rank + HEAD_BLEND * head_rank.
# Setting to 0.0 disables the head path entirely.
HEAD_BLEND = float(os.environ.get("RANKME_HEAD_BLEND", "0.0"))


class CLIPEngineV1(BaseEngine):
    """CLIP ViT-L/14 + face-detection + k-NN aesthetic ranking engine."""

    name = "clip_v1"
    version = "1.0.0"

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.mtcnn: Optional[MTCNN] = None
        self.clip_model = None
        self.clip_processor = None
        self.features: Optional[np.ndarray] = None
        self.ranks: Optional[np.ndarray] = None
        self.wages: Optional[np.ndarray] = None
        self.ids: Optional[np.ndarray] = None
        self.head: Optional[torch.nn.Module] = None
        self.load_model()

    # ---------- model loading ----------

    def load_model(self) -> None:
        # Lazy-import transformers so the rest of the codebase (tests, the
        # legacy engine) doesn't pay the import cost when CLIP isn't selected.
        from transformers import CLIPModel, CLIPProcessor

        logger.info(f"Loading CLIP ({CLIP_MODEL_ID}) on {self.device}...")
        self.mtcnn = MTCNN(
            image_size=224,        # CLIP ViT-L/14 uses 224x224 inputs
            margin=20,
            min_face_size=40,
            thresholds=[0.6, 0.7, 0.7],
            post_process=True,
            device=self.device,
            keep_all=False,
        )
        self.clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
        self.clip_model = CLIPModel.from_pretrained(CLIP_MODEL_ID).eval().to(self.device)

        features_path = os.environ.get("CLIP_FEATURES_PATH", "/models/features_clip.npz")
        if os.path.exists(features_path):
            data = np.load(features_path)
            self.features = data["features"]
            self.ranks = data["ranks"]
            self.wages = data["wages"]
            self.ids = data["ids"]
            label_source = (
                str(data["label_source"].item())
                if "label_source" in data.files
                else "unknown"
            )
            unique = len(set(self.ids.tolist()))
            logger.info(
                f"Loaded {len(self.features)} CLIP embeddings "
                f"({unique} unique persons, rank {self.ranks.min()}-{self.ranks.max()}, "
                f"source={label_source})"
            )
        else:
            logger.warning(
                f"No CLIP features at {features_path}. Engine will run in fallback mode "
                f"until ai/precompute_clip.py is run and the npz is shipped."
            )

        head_path = os.environ.get("CLIP_HEAD_PATH", "/models/clip_head.pt")
        if HEAD_BLEND > 0.0 and os.path.exists(head_path):
            try:
                self.head = _load_head(head_path, device=self.device)
                logger.info(f"Loaded CLIP regression head from {head_path}")
            except Exception:
                logger.exception("Failed to load CLIP head; continuing without it.")
                self.head = None

    # ---------- inference helpers ----------

    @torch.no_grad()
    def _extract_features(self, image: Image.Image) -> Optional[np.ndarray]:
        """Detect a face, then CLIP-encode it. Returns an L2-normalized 768-d vec."""
        face_tensor = self.mtcnn(image)
        if face_tensor is None:
            return None

        # MTCNN returns a tensor in [-1, 1]. CLIP expects PIL or normalized
        # pixel_values produced by the processor. The cleanest, lowest-risk
        # path is to re-render the cropped face to a PIL image and run the
        # standard processor; this also matches what training-time code paths
        # will do, so the embedding space is consistent.
        face_uint8 = ((face_tensor.clamp(-1.0, 1.0) + 1.0) * 127.5).to(torch.uint8)
        # tensor (C, H, W) -> PIL
        face_np = face_uint8.cpu().numpy().transpose(1, 2, 0)
        face_pil = Image.fromarray(face_np, mode="RGB")

        inputs = self.clip_processor(images=face_pil, return_tensors="pt").to(self.device)
        emb = self.clip_model.get_image_features(**inputs).cpu().numpy()[0]
        emb = emb / (np.linalg.norm(emb) + 1e-8)
        return emb.astype(np.float32)

    @torch.no_grad()
    def _head_predict(self, emb: np.ndarray) -> Optional[float]:
        if self.head is None:
            return None
        x = torch.from_numpy(emb).float().to(self.device).unsqueeze(0)
        y = self.head(x).cpu().numpy()[0]
        return float(np.clip(y, 1.0, 10.0))

    # ---------- main prediction ----------

    def predict(self, image: Image.Image) -> dict:
        feat = self._extract_features(image)

        if feat is None:
            # Caller (main.py) converts this to HTTP 400 via the same code path
            # as similarity_v1, so downstream behavior is identical.
            return {
                "rank": 0,
                "confidence": 0.0,
                "features": {
                    "error": "face_not_detected",
                    "improvement_areas": [],
                },
            }

        if self.features is None:
            return self._fallback_predict(emb=feat)

        # ---- k-NN cosine over CLIP embedding space ----
        similarities = self.features @ feat  # both L2-normalized → cosine

        k = min(K_NEIGHBORS, len(similarities))
        top_indices = np.argsort(similarities)[-k:][::-1]
        top_sims = similarities[top_indices]
        top_ranks = self.ranks[top_indices]
        top_wages = self.wages[top_indices]
        top_ids = self.ids[top_indices]

        # Softmax weighting (same temperature as similarity_v1 for parity)
        shifted = (top_sims - top_sims.max()) / TEMPERATURE
        weights = np.exp(shifted)
        weights = weights / weights.sum()

        predicted_rank_knn = float(np.dot(weights, top_ranks))
        predicted_wage = float(np.dot(weights, top_wages))

        # Optional head blending
        head_rank = self._head_predict(feat)
        if head_rank is not None and HEAD_BLEND > 0.0:
            predicted_rank = (1.0 - HEAD_BLEND) * predicted_rank_knn + HEAD_BLEND * head_rank
        else:
            predicted_rank = predicted_rank_knn

        # ---- bucket vote argmax with tie-break (identical to similarity_v1) ----
        bucket_weights = np.zeros(11, dtype=np.float64)
        for w, r in zip(weights, top_ranks):
            r_int = int(r)
            if 1 <= r_int <= 10:
                bucket_weights[r_int] += float(w)

        # If a head is blended, nudge the tie-break target toward the blended mean
        # so head and votes agree at the boundary.
        max_w = float(bucket_weights.max())
        candidates = [r for r in range(1, 11) if bucket_weights[r] >= max_w - 1e-6]
        if len(candidates) == 1:
            rank = candidates[0]
        else:
            rank = min(candidates, key=lambda r: (abs(r - predicted_rank), -r))

        # ---- confidence (same blend as similarity_v1) ----
        max_sim = float(top_sims[0])
        rank_std = float(np.std(top_ranks))
        agreement = max(0.0, 1.0 - rank_std / 3.0)
        # CLIP cosine for face crops empirically sits in 0.5-0.95. Rescale so 1.0
        # ≈ "obvious twin"; subtracting 0.5 keeps the score sensitive in the
        # mid-range where most queries land.
        sim_score = max(0.0, (max_sim - 0.5) / 0.45)
        vote_concentration = float(bucket_weights[rank])
        confidence = round(
            max(0.0, min(1.0, sim_score * 0.5 + agreement * 0.25 + vote_concentration * 0.25)),
            3,
        )

        # ---- diagnostics ----
        seen_ids = set()
        neighbors = []
        for i in range(len(top_indices)):
            pid = int(top_ids[i])
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            neighbors.append({
                "person_id": pid,
                "similarity": round(float(top_sims[i]), 3),
                "rank": int(top_ranks[i]),
                "wage": int(top_wages[i]),
            })
            if len(neighbors) >= 5:
                break

        vote_distribution = {
            str(r): round(float(bucket_weights[r]), 4)
            for r in range(1, 11)
            if bucket_weights[r] > 0
        }

        # ---- raw embedding for persistence / fine-tune (matches similarity_v1 shape) ----
        import base64
        embedding_b64 = base64.b64encode(feat.tobytes()).decode("ascii")

        features = {
            "predicted_wage": round(predicted_wage),
            "confidence": confidence,
            "top_similarity": round(max_sim, 3),
            "rank_raw": round(predicted_rank, 2),
            "rank_raw_knn": round(predicted_rank_knn, 2),
            "rank_raw_head": (round(head_rank, 2) if head_rank is not None else None),
            "vote_distribution": vote_distribution,
            "neighbors": neighbors,
            "improvement_areas": self._get_improvement_areas(rank, confidence),
            "embedding_b64": embedding_b64,
            "embedding_model": CLIP_MODEL_ID,
            "embedding_dim": int(feat.shape[0]),
        }

        return {
            "rank": rank,
            "confidence": confidence,
            "features": features,
        }

    def _get_improvement_areas(self, rank: int, confidence: float) -> list[str]:
        # Mirror similarity_v1's mapping so frontend advice stays consistent
        # while we swap the backbone. ITM-MGFA-style per-attribute scoring is
        # tracked separately as Phase 3.
        areas: list[str] = []
        if rank <= 3:
            areas.extend([
                "skin_quality", "hair_balance", "overall_grooming",
                "eye_impression", "face_symmetry",
            ])
        elif rank <= 5:
            areas.extend([
                "eyebrow_shape", "skin_tone_uniformity",
                "hair_balance", "lip_shape",
            ])
        elif rank <= 7:
            areas.extend([
                "eyebrow_shape", "facial_proportion", "jawline",
            ])
        elif rank <= 9:
            areas.extend([
                "skin_tone_uniformity", "nose_shape",
            ])
        return areas

    def _fallback_predict(self, emb: np.ndarray) -> dict:
        # No training data → behave like similarity_v1's fallback so the rest
        # of the pipeline (DB save, advice gen) still has a sane response.
        import base64
        return {
            "rank": 5,
            "confidence": 0.1,
            "features": {
                "mode": "fallback",
                "improvement_areas": ["overall_grooming"],
                "embedding_b64": base64.b64encode(emb.tobytes()).decode("ascii"),
                "embedding_model": CLIP_MODEL_ID,
                "embedding_dim": int(emb.shape[0]),
            },
        }


# --------------------------------------------------------------------------
# Optional MLP head loader. Kept in the same module so the engine has no extra
# import-time surface area when the head is absent.
# --------------------------------------------------------------------------


class _ClipRegressionHead(torch.nn.Module):
    """Small MLP: CLIP image embedding → continuous rank in [1, 10].

    Same architecture used by `ai/scripts/train_clip_head.py`. Keeping this in
    one place avoids "shape mismatch" surprises between train and serve.
    """

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

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Squash to (1, 10) with a scaled sigmoid; gives stable gradients at the
        # boundaries and matches the head we train on SCUT-FBP5500 (1..5 rescaled
        # to 1..10).
        raw = self.net(x).squeeze(-1)
        return 1.0 + 9.0 * torch.sigmoid(raw)


def _load_head(path: str, device: str) -> torch.nn.Module:
    state = torch.load(path, map_location=device)
    if isinstance(state, dict) and "state_dict" in state:
        emb_dim = int(state.get("emb_dim", 768))
        head = _ClipRegressionHead(emb_dim=emb_dim).to(device)
        head.load_state_dict(state["state_dict"])
    else:
        # Plain state_dict (older artifacts)
        head = _ClipRegressionHead().to(device)
        head.load_state_dict(state)
    head.eval()
    return head
