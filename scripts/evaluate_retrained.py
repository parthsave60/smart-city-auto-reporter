import os
import sys
import json
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = os.path.join(PROJECT_ROOT, "models", "civic_issue_classifier_retrained")
CHECKPOINT_PATH = os.path.join(MODEL_DIR, "best_model.pth")
DATASET_ROOT = r"C:\Users\Parth Save\Downloads\archive\civicIssues Dataset"
TEST_DIR = os.path.join(DATASET_ROOT, "TEST")

TARGET_CLASSES = [
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

CLASS_TO_ISSUE_TYPE = {
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

class_to_idx = {cls: idx for idx, cls in enumerate(TARGET_CLASSES)}
idx_to_class = {idx: cls for idx, cls in enumerate(TARGET_CLASSES)}

device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

# Collect test set
test_paths = []
test_labels = []
valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

for cls in TARGET_CLASSES:
    cls_dir = os.path.join(TEST_DIR, cls)
    c_idx = class_to_idx[cls]
    cnt = 0
    for dirpath, _, filenames in os.walk(cls_dir):
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext in valid_exts:
                test_paths.append(os.path.join(dirpath, fname))
                test_labels.append(c_idx)
                cnt += 1
    print(f"Test count for {cls}: {cnt}")

class TestDataset(Dataset):
    def __init__(self, paths, labels, transform):
        self.paths = paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, idx):
        path = self.paths[idx]
        label = self.labels[idx]
        try:
            image = Image.open(path).convert("RGB")
        except Exception:
            image = Image.new("RGB", (224, 224), (128, 128, 128))
        return self.transform(image), label

eval_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

test_dataset = TestDataset(test_paths, test_labels, eval_transforms)
test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False, num_workers=0)

# Load checkpoint
print(f"\nLoading retrained checkpoint from {CHECKPOINT_PATH}...")
checkpoint = torch.load(CHECKPOINT_PATH, map_location=device)
model = models.mobilenet_v3_large(weights=None)
in_features = model.classifier[3].in_features
model.classifier[3] = nn.Sequential(
    nn.Dropout(p=0.3, inplace=True),
    nn.Linear(in_features, len(TARGET_CLASSES))
)
model.load_state_dict(checkpoint["model_state_dict"])
model = model.to(device)
model.eval()

all_preds = []
all_targets = []
all_probs = []

start_eval = time.time()
with torch.no_grad():
    for images, labels in test_loader:
        images = images.to(device)
        outputs = model(images)
        probs = torch.softmax(outputs, dim=1)
        _, preds = torch.max(probs, 1)

        all_preds.extend(preds.cpu().numpy().tolist())
        all_targets.extend(labels.numpy().tolist())
        all_probs.extend(probs.cpu().numpy().tolist())

eval_time = time.time() - start_eval
total_test = len(all_targets)
correct = sum(p == t for p, t in zip(all_preds, all_targets))
test_accuracy = correct / total_test

cls_report = classification_report(
    all_targets,
    all_preds,
    target_names=TARGET_CLASSES,
    digits=4,
    output_dict=True,
    zero_division=0
)

cm = confusion_matrix(all_targets, all_preds)

print("\n" + "=" * 80)
print(f"RETRAINED MODEL TEST SET RESULTS (Accuracy: {test_accuracy*100:.2f}%)")
print("=" * 80)
print(f"{'Class':32s} | {'Precision':10s} | {'Recall':10s} | {'F1-Score':10s} | {'Support':8s}")
print("-" * 80)
for cls in TARGET_CLASSES:
    metrics = cls_report[cls]
    print(f"{cls:32s} | {metrics['precision']*100:9.2f}% | {metrics['recall']*100:9.2f}% | {metrics['f1-score']*100:9.2f}% | {int(metrics['support']):7d}")
print("-" * 80)
print(f"{'Macro Average':32s} | {cls_report['macro avg']['precision']*100:9.2f}% | {cls_report['macro avg']['recall']*100:9.2f}% | {cls_report['macro avg']['f1-score']*100:9.2f}% | {total_test:7d}")
print(f"{'Weighted Average':32s} | {cls_report['weighted avg']['precision']*100:9.2f}% | {cls_report['weighted avg']['recall']*100:9.2f}% | {cls_report['weighted avg']['f1-score']*100:9.2f}% | {total_test:7d}")
print("=" * 80)

# Save JSON results
results = {
    "test_accuracy": float(test_accuracy),
    "correct": int(correct),
    "total": int(total_test),
    "classification_report": cls_report,
    "confusion_matrix": cm.tolist(),
    "evaluation_time_seconds": float(eval_time),
    "best_epoch": checkpoint.get("epoch"),
    "val_acc": checkpoint.get("val_acc"),
    "val_f1": checkpoint.get("val_f1"),
    "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
}

with open(os.path.join(MODEL_DIR, "test_results.json"), "w") as f:
    json.dump(results, f, indent=2)

with open(os.path.join(MODEL_DIR, "classification_report.json"), "w") as f:
    json.dump(cls_report, f, indent=2)

# Save metadata configs in retrained dir
with open(os.path.join(MODEL_DIR, "class_to_idx.json"), "w") as f:
    json.dump(class_to_idx, f, indent=2)

with open(os.path.join(MODEL_DIR, "idx_to_class.json"), "w") as f:
    json.dump(idx_to_class, f, indent=2)

with open(os.path.join(MODEL_DIR, "class_to_issue_type.json"), "w") as f:
    json.dump(CLASS_TO_ISSUE_TYPE, f, indent=2)

model_config = {
    "architecture": "mobilenet_v3_large",
    "num_classes": len(TARGET_CLASSES),
    "classes": TARGET_CLASSES,
    "input_size": [3, 224, 224],
    "mean": [0.485, 0.456, 0.406],
    "std": [0.229, 0.224, 0.225],
    "confidence_threshold": 0.55,
    "best_epoch": checkpoint.get("epoch"),
    "best_val_acc": float(checkpoint.get("val_acc", 0.0)),
    "best_val_f1": float(checkpoint.get("val_f1", 0.0)),
    "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
}
with open(os.path.join(MODEL_DIR, "model_config.json"), "w") as f:
    json.dump(model_config, f, indent=2)

print("\nSaved all test results & metadata configs to models/civic_issue_classifier_retrained/")
