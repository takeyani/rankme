"""
Precompute feature vectors from training images using ResNet18.
Face-cropped + per-person averaged features saved to /models/features.npz
"""

import csv
import os
import glob
import numpy as np
import cv2
from PIL import Image
import torch
import torchvision.transforms as T
from torchvision.models import resnet18, ResNet18_Weights

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def get_model():
    model = resnet18(weights=ResNet18_Weights.DEFAULT)
    model.fc = torch.nn.Identity()
    model.eval()
    return model


def get_transform():
    return T.Compose([
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


def crop_face(img: Image.Image, margin: float = 0.4) -> Image.Image | None:
    """Detect and crop the largest face with margin. Returns None if no face."""
    img_array = np.array(img)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(faces) == 0:
        return None

    # Pick largest face
    areas = [w * h for (x, y, w, h) in faces]
    x, y, w, h = faces[np.argmax(areas)]

    # Add margin
    img_h, img_w = img_array.shape[:2]
    mx = int(w * margin)
    my = int(h * margin)
    x1 = max(0, x - mx)
    y1 = max(0, y - my)
    x2 = min(img_w, x + w + mx)
    y2 = min(img_h, y + h + my)

    return img.crop((x1, y1, x2, y2))


def load_labels(csv_path: str) -> dict[int, dict]:
    labels = {}
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = int(row["photo_id"])
            labels[pid] = {
                "wage": int(row["wage"]),
                "rank": int(row["rank"]),
                "style": row.get("style", ""),
            }
    return labels


def find_images(training_dir: str, photo_id: int) -> list[str]:
    folder_names = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]
    images = []
    for folder in folder_names:
        pattern = os.path.join(training_dir, "**", folder, f"{photo_id}.jpg")
        images.extend(glob.glob(pattern, recursive=True))
    return images


def main():
    training_dir = os.environ.get("TRAINING_DIR", "/training-data")
    model_dir = os.environ.get("MODEL_DIR", "/models")
    csv_path = os.path.join(training_dir, "labels.csv")

    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} not found")
        return

    print("Loading model...")
    model = get_model()
    transform = get_transform()

    print("Loading labels...")
    labels = load_labels(csv_path)
    print(f"  Found {len(labels)} labeled entries")

    # --- Phase 1: Extract per-image features (face-cropped) ---
    person_features: dict[int, list[np.ndarray]] = {}
    face_found = 0
    face_missed = 0

    print("Extracting face-cropped features...")
    for pid, info in sorted(labels.items()):
        images = find_images(training_dir, pid)
        if not images:
            print(f"  WARNING: No images found for photo_id={pid}")
            continue

        person_features[pid] = []
        for img_path in images:
            try:
                img = Image.open(img_path).convert("RGB")
                face_img = crop_face(img)

                if face_img is None:
                    face_missed += 1
                    # Fallback: use center crop of original
                    face_img = img
                else:
                    face_found += 1

                tensor = transform(face_img).unsqueeze(0)
                with torch.no_grad():
                    feat = model(tensor).squeeze().numpy()
                feat = feat / (np.linalg.norm(feat) + 1e-8)
                person_features[pid].append(feat)

            except Exception as e:
                print(f"  ERROR processing {img_path}: {e}")

    print(f"  Face detected: {face_found}, missed: {face_missed}")

    # --- Phase 2: Average per person ---
    all_features = []
    all_ranks = []
    all_wages = []
    all_ids = []

    print("Averaging per-person features...")
    for pid, feats in sorted(person_features.items()):
        if not feats:
            continue
        avg_feat = np.mean(feats, axis=0)
        avg_feat = avg_feat / (np.linalg.norm(avg_feat) + 1e-8)

        all_features.append(avg_feat)
        all_ranks.append(labels[pid]["rank"])
        all_wages.append(labels[pid]["wage"])
        all_ids.append(pid)

    if not all_features:
        print("ERROR: No features extracted")
        return

    features = np.stack(all_features)
    ranks = np.array(all_ranks)
    wages = np.array(all_wages)
    ids = np.array(all_ids)

    os.makedirs(model_dir, exist_ok=True)
    output_path = os.path.join(model_dir, "features.npz")
    np.savez(output_path, features=features, ranks=ranks, wages=wages, ids=ids)
    print(f"Saved {len(features)} person-averaged vectors to {output_path}")
    print(f"  Rank distribution: {dict(zip(*np.unique(ranks, return_counts=True)))}")


if __name__ == "__main__":
    main()
