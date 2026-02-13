import os
import io
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from engine_registry import EngineRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RankMe AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Engine Registry
registry = EngineRegistry()
ACTIVE_ENGINE = os.getenv("RANKME_ENGINE", "similarity_v1")


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
