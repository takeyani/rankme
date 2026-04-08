import os
import io
import logging
import numpy as np
import cv2
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from engine_registry import EngineRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RankMe AI Service", version="0.1.0")

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",")] if allowed_origins_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Engine Registry
registry = EngineRegistry()
ACTIVE_ENGINE = os.getenv("RANKME_ENGINE", "similarity_v1")

# Face detector
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def detect_face(image: Image.Image) -> bool:
    """Return True if at least one face is detected."""
    img_array = np.array(image)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return len(faces) > 0


class PredictResponse(BaseModel):
    rank: int
    confidence: float
    features: dict
    engine: str


class HealthResponse(BaseModel):
    status: str
    engine: str
    version: str


@app.post("/predict", response_model=PredictResponse)
async def predict(image: UploadFile = File(...)):
    # Validate file type
    if image.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG images are supported")

    # Read and validate image
    contents = await image.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Face detection
    if not detect_face(img):
        raise HTTPException(status_code=400, detail="顔が検出できませんでした。人の顔が写った画像をアップロードしてください")

    # Get engine and predict
    engine = registry.get_engine(ACTIVE_ENGINE)
    if engine is None:
        raise HTTPException(status_code=500, detail=f"Engine '{ACTIVE_ENGINE}' not found")

    result = engine.predict(img)

    return PredictResponse(
        rank=result["rank"],
        confidence=result["confidence"],
        features=result["features"],
        engine=ACTIVE_ENGINE,
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    engine = registry.get_engine(ACTIVE_ENGINE)
    return HealthResponse(
        status="healthy",
        engine=ACTIVE_ENGINE,
        version=engine.version if engine else "unknown",
    )
