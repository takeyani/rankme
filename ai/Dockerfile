FROM python:3.11-slim

WORKDIR /app

# Install minimal system dependencies (curl for healthcheck only)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download FaceNet VGGFace2 weights (~100MB) to bake into the image
# This avoids runtime download on first request
RUN python -c "from facenet_pytorch import InceptionResnetV1, MTCNN; InceptionResnetV1(pretrained='vggface2').eval(); MTCNN()"

# Copy AI service code
COPY ai/ /app/

# Copy precomputed features (committed to git for deployment)
COPY models/ /models/

EXPOSE 8000

# Use $PORT for Railway/HF Spaces compatibility (defaults to 8000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
