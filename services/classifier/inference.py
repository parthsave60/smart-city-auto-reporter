import os
import sys
import json
import io
import threading
import urllib.request
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image, ImageFile, ImageOps
ImageFile.LOAD_TRUNCATED_IMAGES = True

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_DIR = os.path.join(PROJECT_ROOT, "models", "civic_issue_classifier")

CHECKPOINT_PATH = os.path.join(MODEL_DIR, "best_model.pth")
CLASS_TO_IDX_PATH = os.path.join(MODEL_DIR, "class_to_idx.json")
CLASS_TO_ISSUE_TYPE_PATH = os.path.join(MODEL_DIR, "class_to_issue_type.json")
CONFIG_PATH = os.path.join(MODEL_DIR, "model_config.json")

class CivicClassifierService:
    def __init__(self, checkpoint_path=CHECKPOINT_PATH):
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.checkpoint_path = checkpoint_path
        self.model = None
        self.class_to_idx = {}
        self.idx_to_class = {}
        self.class_to_issue_type = {}
        self.confidence_threshold = 0.55
        self.transform = None
        self._inference_lock = threading.Lock()

        self._init_transforms()
        self._load_metadata()
        self._load_model()

    def _init_transforms(self):
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

    def _load_metadata(self):
        if os.path.exists(CLASS_TO_IDX_PATH):
            with open(CLASS_TO_IDX_PATH, "r") as f:
                self.class_to_idx = json.load(f)
            self.idx_to_class = {v: k for k, v in self.class_to_idx.items()}
        else:
            default_classes = [
                "Damaged concrete structures",
                "DamagedElectricalPoles",
                "DamagedRoadSigns",
                "DeadAnimalsPollution",
                "FallenTrees",
                "Garbage",
                "Graffitti",
                "IllegalParking",
                "Potholes and RoadCracks"
            ]
            self.class_to_idx = {cls: idx for idx, cls in enumerate(default_classes)}
            self.idx_to_class = {idx: cls for idx, cls in enumerate(default_classes)}

        if os.path.exists(CLASS_TO_ISSUE_TYPE_PATH):
            with open(CLASS_TO_ISSUE_TYPE_PATH, "r") as f:
                self.class_to_issue_type = json.load(f)
        else:
            self.class_to_issue_type = {
                "Damaged concrete structures": "damaged-concrete",
                "DamagedElectricalPoles": "electrical-pole",
                "DamagedRoadSigns": "damaged-road-sign",
                "DeadAnimalsPollution": "dead-animal-pollution",
                "FallenTrees": "fallen-tree",
                "Garbage": "garbage",
                "Graffitti": "graffiti",
                "IllegalParking": "illegal-parking",
                "Potholes and RoadCracks": "pothole"
            }

        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, "r") as f:
                cfg = json.load(f)
                self.confidence_threshold = cfg.get("confidence_threshold", 0.55)

    def _load_model(self):
        num_classes = len(self.class_to_idx)
        print(f"[CivicClassifierService] Initializing MobileNetV3-Large ({num_classes} classes) on {self.device}...")
        self.model = models.mobilenet_v3_large(weights=None)
        in_features = self.model.classifier[3].in_features
        self.model.classifier[3] = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(in_features, num_classes)
        )

        if os.path.exists(self.checkpoint_path):
            checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
            state_dict = checkpoint.get("model_state_dict", checkpoint)
            self.model.load_state_dict(state_dict)
            print(f"[CivicClassifierService] Loaded checkpoint from {self.checkpoint_path}")
        else:
            print(f"[CivicClassifierService] Notice: checkpoint {self.checkpoint_path} not ready yet. Ready for post-training reload.")

        self.model = self.model.to(self.device)
        self.model.eval()

    def reload_checkpoint(self):
        """Reload checkpoint after training is complete"""
        self._load_metadata()
        self._load_model()

    def _fetch_image(self, image_source):
        """Load image from URL, file path, bytes, base64, or PIL Image with EXIF orientation normalization"""
        if isinstance(image_source, Image.Image):
            return ImageOps.exif_transpose(image_source.convert("RGB"))

        if isinstance(image_source, bytes):
            img = Image.open(io.BytesIO(image_source)).convert("RGB")
            return ImageOps.exif_transpose(img)

        if isinstance(image_source, str):
            # Base64 string
            if "base64," in image_source:
                import base64
                b64_data = image_source.split("base64,", 1)[1]
                img = Image.open(io.BytesIO(base64.b64decode(b64_data))).convert("RGB")
                return ImageOps.exif_transpose(img)

            # Remote URL (Cloudinary / CDN)
            if image_source.startswith("http://") or image_source.startswith("https://"):
                url = image_source
                # Optimize Cloudinary URLs for standard format and bandwidth
                if "res.cloudinary.com" in url:
                    if "/image/upload/" in url and "/f_jpg" not in url:
                        url = url.replace("/image/upload/", "/image/upload/f_jpg,q_auto,w_1280,c_limit/")
                    if url.lower().endswith(".heic"):
                        url = url[:-5] + ".jpg"

                import ssl
                ctx = ssl._create_unverified_context()
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                    }
                )
                with urllib.request.urlopen(req, timeout=25, context=ctx) as resp:
                    data = resp.read()
                img = Image.open(io.BytesIO(data)).convert("RGB")
                return ImageOps.exif_transpose(img)
            
            if os.path.exists(image_source):
                img = Image.open(image_source).convert("RGB")
                return ImageOps.exif_transpose(img)

        raise ValueError(f"Unsupported image source: {type(image_source)}")

    def predict(self, image_source):
        """
        Run inference on an image with thread synchronization.
        """
        image = self._fetch_image(image_source)
        input_tensor = self.transform(image).unsqueeze(0).to(self.device)

        with self._inference_lock:
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probs = torch.softmax(outputs, dim=1).squeeze(0)

        top_probs, top_indices = torch.topk(probs, min(3, len(probs)))
        top_probs = top_probs.cpu().numpy().tolist()
        top_indices = top_indices.cpu().numpy().tolist()

        best_idx = int(top_indices[0])
        best_conf = float(top_probs[0])
        best_class = self.idx_to_class.get(best_idx, f"Class {best_idx}")
        best_issue_type = self.class_to_issue_type.get(best_class, "other")

        is_uncertain = best_conf < self.confidence_threshold

        top_preds = []
        for p, idx in zip(top_probs, top_indices):
            c_name = self.idx_to_class.get(int(idx), f"Class {idx}")
            top_preds.append({
                "className": c_name,
                "confidence": round(float(p), 4),
                "classIndex": int(idx),
                "issueTypeId": self.class_to_issue_type.get(c_name, "other")
            })

        return {
            "predictedClass": "Uncertain / Other" if is_uncertain else best_class,
            "rawClass": best_class,
            "confidence": round(best_conf, 4),
            "classIndex": -1 if is_uncertain else best_idx,
            "rawClassIndex": best_idx,
            "issueTypeId": "other" if is_uncertain else best_issue_type,
            "isUncertain": is_uncertain,
            "confidenceThreshold": self.confidence_threshold,
            "topPredictions": top_preds
        }

# Global singleton
_service_instance = None

def get_classifier_service():
    global _service_instance
    if _service_instance is None:
        _service_instance = CivicClassifierService()
    return _service_instance
