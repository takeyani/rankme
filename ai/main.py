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

# Cap Pillow decompression size to prevent decompression bombs (~6000x6000)
Image.MAX_IMAGE_PIXELS = 32_000_000

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_IMAGE_DIMENSION = 4096       # 4K, prevents decompression bombs

app = FastAPI(title="RankMe AI Service", version="2.0.0")

# CORS: lock down to explicit allowlist if ALLOWED_ORIGINS is set
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*").strip()
if allowed_origins_env == "*":
    # Permissive mode (development); credentials must be False
    allowed_origins = ["*"]
    allow_credentials = False
    logger.warning("CORS in permissive mode (allow all origins). Set ALLOWED_ORIGINS for production.")
else:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip() and o.strip() != "*"]
    allow_credentials = True
    logger.info(f"CORS locked to: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST"],
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

    # Read and validate image size
    contents = await image.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")

    # Decode image with strict bounds
    try:
        img = Image.open(io.BytesIO(contents))
        # Verify dimensions BEFORE full decode to prevent decompression bombs
        if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=400,
                detail=f"Image resolution too large (max {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION})",
            )
        img = img.convert("RGB")
    except HTTPException:
        raise
    except Image.DecompressionBombError:
        raise HTTPException(status_code=400, detail="Image too large to decode")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Get engine and predict (face detection happens inside MTCNN)
    engine = registry.get_engine(ACTIVE_ENGINE)
    if engine is None:
        logger.error(f"Engine '{ACTIVE_ENGINE}' not found")
        raise HTTPException(status_code=500, detail="AI engine unavailable")

    try:
        result = engine.predict(img)
    except Exception as e:
        logger.exception("Engine prediction failed")
        raise HTTPException(status_code=500, detail="AI inference failed")

    # Check if MTCNN detected a face
    if result.get("features", {}).get("error") == "face_not_detected":
        raise HTTPException(
            status_code=400,
            detail="顔が検出できませんでした。人の顔が写った画像をアップロードしてください",
        )

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
