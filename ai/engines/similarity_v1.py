import os
import logging
import numpy as np
from PIL import Image
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
from engine_registry import BaseEngine

logger = logging.getLogger(__name__)

K_NEIGHBORS = 15  # More neighbors since we have ~5x augmented data


class SimilarityEngineV1(BaseEngine):
    """
    Face similarity ranking engine v2.

    - Face detection: MTCNN
    - Embedding: FaceNet InceptionResnetV1 (VGGFace2 pretrained)
    - Matching: k-NN with cosine similarity + Softmax weighting
    - Training data: 5x augmented embeddings per training image
    """

    name = "similarity_v1"
    version = "2.0.0"

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.mtcnn = None
        self.embedder = None
        self.features = None
        self.ranks = None
        self.wages = None
        self.ids = None
        self.load_model()

    def load_model(self) -> None:
        logger.info(f"Loading FaceNet on {self.device}...")
        self.mtcnn = MTCNN(
            image_size=160,
            margin=20,
            min_face_size=40,
            thresholds=[0.6, 0.7, 0.7],
            post_process=True,
            device=self.device,
            keep_all=False,
        )
        self.embedder = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)

        features_path = os.environ.get("FEATURES_PATH", "/models/features.npz")
        if os.path.exists(features_path):
            data = np.load(features_path)
            self.features = data["features"]
            self.ranks = data["ranks"]
            self.wages = data["wages"]
            self.ids = data["ids"]
            unique_persons = len(set(self.ids.tolist()))
            logger.info(
                f"Loaded {len(self.features)} embeddings "
                f"({unique_persons} unique persons, "
                f"rank range {self.ranks.min()}-{self.ranks.max()})"
            )
        else:
            logger.warning(f"No features at {features_path}. Using fallback mode.")

    @torch.no_grad()
    def _extract_features(self, image: Image.Image) -> np.ndarray | None:
        """Extract L2-normalized face embedding. Returns None if no face."""
        face_tensor = self.mtcnn(image)
        if face_tensor is None:
            return None

        batch = face_tensor.unsqueeze(0).to(self.device)
        emb = self.embedder(batch).cpu().numpy()[0]
        emb = emb / (np.linalg.norm(emb) + 1e-8)
        return emb

    def predict(self, image: Image.Image) -> dict:
        feat = self._extract_features(image)

        if feat is None:
            # Face not detected by MTCNN
            return {
                "rank": 1,
                "confidence": 0.0,
                "features": {
                    "error": "face_not_detected",
                    "improvement_areas": [],
                },
            }

        if self.features is None:
            return self._fallback_predict()

        # Cosine similarity
        similarities = self.features @ feat

        k = min(K_NEIGHBORS, len(similarities))
        top_indices = np.argsort(similarities)[-k:][::-1]

        top_sims = similarities[top_indices]
        top_ranks = self.ranks[top_indices]
        top_wages = self.wages[top_indices]
        top_ids = self.ids[top_indices]

        # Softmax-style weighting (sharp temperature for FaceNet's discriminative space)
        temperature = 0.07
        shifted = (top_sims - top_sims.max()) / temperature
        weights = np.exp(shifted)
        weights = weights / weights.sum()

        predicted_rank = float(np.dot(weights, top_ranks))
        predicted_wage = float(np.dot(weights, top_wages))

        rank = max(1, min(10, round(predicted_rank)))

        # Confidence: top similarity + agreement among neighbors
        max_sim = float(top_sims[0])
        rank_std = float(np.std(top_ranks))
        agreement = max(0, 1.0 - rank_std / 3.0)
        # FaceNet similarities are typically 0.3-0.9 for faces, so rescale
        sim_score = max(0, (max_sim - 0.3) / 0.6)
        confidence = round(max(0.0, min(1.0, sim_score * 0.6 + agreement * 0.4)), 3)

        # Top neighbors (deduplicated by person)
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

        features = {
            "predicted_wage": round(predicted_wage),
            "confidence": confidence,
            "top_similarity": round(max_sim, 3),
            "rank_raw": round(predicted_rank, 2),
            "neighbors": neighbors,
            "improvement_areas": self._get_improvement_areas(rank, confidence),
        }

        return {
            "rank": rank,
            "confidence": confidence,
            "features": features,
        }

    def _get_improvement_areas(self, rank: int, confidence: float) -> list[str]:
        areas = []
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

    def _fallback_predict(self) -> dict:
        return {
            "rank": 5,
            "confidence": 0.1,
            "features": {
                "mode": "fallback",
                "improvement_areas": ["overall_grooming"],
            },
        }
