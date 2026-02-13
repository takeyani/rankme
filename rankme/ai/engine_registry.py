from abc import ABC, abstractmethod
from typing import Optional
from PIL import Image


class BaseEngine(ABC):
    """Base class for all ranking engines."""

    name: str = "base"
    version: str = "0.0.0"

    @abstractmethod
    def predict(self, image: Image.Image) -> dict:
        """
        Predict rank for a given face image.

        Args:
            image: PIL Image (RGB)

        Returns:
            dict with keys:
                - rank: int (1-10)
                - confidence: float (0.0-1.0)
                - features: dict (engine-specific features for advice generation)
        """
        pass

    @abstractmethod
    def load_model(self) -> None:
        """Load the model weights."""
        pass


class EngineRegistry:
    """Registry for managing multiple ranking engines."""

    def __init__(self):
        self._engines: dict[str, BaseEngine] = {}
        self._register_default_engines()

    def _register_default_engines(self):
        from engines.similarity_v1 import SimilarityEngineV1
        self.register(SimilarityEngineV1())

    def register(self, engine: BaseEngine):
        self._engines[engine.name] = engine

    def get_engine(self, name: str) -> Optional[BaseEngine]:
        return self._engines.get(name)

    def list_engines(self) -> list[str]:
        return list(self._engines.keys())
