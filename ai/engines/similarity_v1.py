import os
import logging
import numpy as np
import cv2
from PIL import Image
import torch
import torchvision.transforms as T
from torchvision.models import resnet18, ResNet18_Weights
from engine_registry import BaseEngine

logger = logging.getLogger(__name__)

K_NEIGHBORS = 7

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


class SimilarityEngineV1(BaseEngine):
    """
    Similarity-based ranking engine v1.

    Uses ResNet18 feature extraction on face-cropped images
    + k-NN against per-person averaged training data.
    """

    name = "similarity_v1"
    version = "1.1.0"

    def __init__(self):
        self.model = None
        self.transform = None
        self.features = None
        self.ranks = None
        self.wages = None
        self.ids = None
        self.load_model()

    def load_model(self) -> None:
        logger.info("Loading ResNet18 feature extractor...")
        self.model = resnet18(weights=ResNet18_Weights.DEFAULT)
        self.model.fc = torch.nn.Identity()
        self.model.eval()

        self.transform = T.Compose([
            T.Resize(256),
            T.CenterCrop(224),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

        features_path = os.environ.get("FEATURES_PATH", "/models/features.npz")
        if os.path.exists(features_path):
            data = np.load(features_path)
            self.features = data["features"]
            self.ranks = data["ranks"]
            self.wages = data["wages"]
            self.ids = data["ids"]
            logger.info(
                f"Loaded {len(self.features)} person vectors "
                f"(rank range {self.ranks.min()}-{self.ranks.max()})"
            )
        else:
            logger.warning(f"No features at {features_path}. Using fallback mode.")

    def _crop_face(self, image: Image.Image, margin: float = 0.4) -> Image.Image:
        """Crop the largest detected face with margin. Returns original if no face."""
        img_array = np.array(image)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )

        if len(faces) == 0:
            return image

        areas = [w * h for (x, y, w, h) in faces]
        x, y, w, h = faces[np.argmax(areas)]

        img_h, img_w = img_array.shape[:2]
        mx, my = int(w * margin), int(h * margin)
        x1 = max(0, x - mx)
        y1 = max(0, y - my)
        x2 = min(img_w, x + w + mx)
        y2 = min(img_h, y + h + my)

        return image.crop((x1, y1, x2, y2))

    def _extract_features(self, image: Image.Image) -> np.ndarray:
        """Extract L2-normalized features from face-cropped image."""
        face_img = self._crop_face(image)
        tensor = self.transform(face_img).unsqueeze(0)
        with torch.no_grad():
            feat = self.model(tensor).squeeze().numpy()
        feat = feat / (np.linalg.norm(feat) + 1e-8)
        return feat

    def predict(self, image: Image.Image) -> dict:
        feat = self._extract_features(image)

        if self.features is None:
            return self._fallback_predict(image)

        # Cosine similarity
        similarities = self.features @ feat

        k = min(K_NEIGHBORS, len(similarities))
        top_indices = np.argsort(similarities)[-k:][::-1]

        top_sims = similarities[top_indices]
        top_ranks = self.ranks[top_indices]
        top_wages = self.wages[top_indices]
        top_ids = self.ids[top_indices]

        # Softmax-style weighting for sharper discrimination
        # Higher temperature = more uniform, lower = winner-takes-all
        temperature = 0.05
        shifted = (top_sims - top_sims.max()) / temperature
        weights = np.exp(shifted)
        weights = weights / weights.sum()

        predicted_rank = float(np.dot(weights, top_ranks))
        predicted_wage = float(np.dot(weights, top_wages))

        rank = max(1, min(10, round(predicted_rank)))

        # Confidence: combination of top similarity and agreement among neighbors
        max_sim = float(top_sims[0])
        rank_std = float(np.std(top_ranks))
        # High similarity + low disagreement = high confidence
        agreement = max(0, 1.0 - rank_std / 3.0)
        confidence = round(max(0.0, min(1.0, max_sim * 0.6 + agreement * 0.4)), 3)

        neighbors = []
        for i in range(min(5, len(top_indices))):
            neighbors.append({
                "person_id": int(top_ids[i]),
                "similarity": round(float(top_sims[i]), 3),
                "rank": int(top_ranks[i]),
                "wage": int(top_wages[i]),
            })

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

    def _fallback_predict(self, image: Image.Image) -> dict:
        img_array = np.array(image.resize((224, 224)))
        brightness = float(np.mean(img_array)) / 255.0
        contrast = float(np.std(img_array)) / 128.0

        raw_score = (brightness * 0.4 + contrast * 0.6) * 10
        rank = max(1, min(10, round(raw_score)))

        return {
            "rank": rank,
            "confidence": 0.1,
            "features": {
                "mode": "fallback",
                "improvement_areas": ["photo_quality", "overall_presentation"],
            },
        }
