import numpy as np
from PIL import Image
from engine_registry import BaseEngine


class SimilarityEngineV1(BaseEngine):
    """
    Similarity-based ranking engine v1.

    Uses feature extraction and cosine similarity against
    training data to determine rank.

    NOTE: This is a placeholder implementation.
    Replace with actual model when training data is available.
    """

    name = "similarity_v1"
    version = "0.1.0"

    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self) -> None:
        """Load model - placeholder for now."""
        # TODO: Load actual trained model
        # self.model = torch.load("/models/similarity_v1.pt")
        pass

    def predict(self, image: Image.Image) -> dict:
        """
        Predict rank based on similarity to training data.

        Current implementation: Returns a deterministic score based on
        image characteristics (placeholder until real model is trained).
        """
        # Convert to numpy for basic feature extraction
        img_array = np.array(image.resize((224, 224)))

        # Placeholder: Extract basic features
        brightness = float(np.mean(img_array)) / 255.0
        contrast = float(np.std(img_array)) / 128.0
        symmetry = self._compute_symmetry(img_array)

        # Placeholder scoring (replace with actual model inference)
        raw_score = (brightness * 0.3 + contrast * 0.3 + symmetry * 0.4) * 10
        rank = max(1, min(10, round(raw_score)))

        features = {
            "brightness": round(brightness, 3),
            "contrast": round(contrast, 3),
            "symmetry": round(symmetry, 3),
            "improvement_areas": self._get_improvement_areas(rank, brightness, contrast, symmetry),
        }

        return {
            "rank": rank,
            "confidence": 0.5,  # Low confidence for placeholder
            "features": features,
        }

    def _compute_symmetry(self, img_array: np.ndarray) -> float:
        """Compute horizontal symmetry score."""
        h, w, _ = img_array.shape
        left = img_array[:, :w // 2, :]
        right = np.flip(img_array[:, w // 2:w // 2 + left.shape[1], :], axis=1)
        diff = np.mean(np.abs(left.astype(float) - right.astype(float)))
        return max(0.0, 1.0 - diff / 128.0)

    def _get_improvement_areas(self, rank: int, brightness: float, contrast: float, symmetry: float) -> list[str]:
        """Determine improvement areas based on features."""
        areas = []
        if brightness < 0.4:
            areas.append("lighting")
        if contrast < 0.3:
            areas.append("contrast")
        if symmetry < 0.6:
            areas.append("symmetry")
        if rank < 7:
            areas.append("overall_presentation")
        return areas
