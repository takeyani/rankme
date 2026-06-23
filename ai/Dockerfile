FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies (curl for healthcheck only)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download FaceNet VGGFace2 weights (~100MB) to bake into the image.
# This avoids runtime download on first request.
RUN python -c "from facenet_pytorch import InceptionResnetV1, MTCNN; InceptionResnetV1(pretrained='vggface2').eval(); MTCNN()"

# Optionally bake in CLIP ViT-L/14 (~1.4GB) when building the clip_v1 image.
# Skipped by default to keep the legacy image small; set INCLUDE_CLIP=1 when
# building the clip_v1 deployment so the model is local and first-request
# latency stays low.
ARG INCLUDE_CLIP=0
RUN if [ "$INCLUDE_CLIP" = "1" ]; then \
      python -c "from transformers import CLIPModel, CLIPProcessor; \
                 CLIPModel.from_pretrained('openai/clip-vit-large-patch14'); \
                 CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14')"; \
    else \
      echo "Skipping CLIP weight prefetch (set --build-arg INCLUDE_CLIP=1 to include)"; \
    fi

# Copy AI service code
COPY ai/ /app/

# Copy precomputed features (committed to git for deployment)
COPY models/ /models/

EXPOSE 8000

# Use $PORT for Railway/HF Spaces compatibility (defaults to 8000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
