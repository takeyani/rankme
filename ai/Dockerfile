FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (curl for healthcheck, libgl/libglib for OpenCV)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI service code
COPY ai/ /app/

# Copy precomputed features (committed to git for deployment)
COPY models/ /models/

EXPOSE 8000

# Use $PORT for Railway compatibility (defaults to 8000)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
