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
import matplotlib.pyplot as plt

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = os.path.join(PROJECT_ROOT, "models", "civic_issue_classifier")
DATASET_ROOT = r"C:\Users\Parth Save\Downloads\archive\civicIssues Dataset"
TEST_DIR = os.path.join(DATASET_ROOT, "TEST")

CHECKPOINT_PATH = os.path.join(MODEL_DIR, "best_model.pth")
CLASS_TO_IDX_PATH = os.path.join(MODEL_DIR, "class_to_idx.json")

print("=" * 60)
print("EVALUATION ON TEST DATASET")
print("=" * 60)

if not os.path.exists(CHECKPOINT_PATH):
    print(f"Error: Model checkpoint not found at {CHECKPOINT_PATH}")
    sys.exit(1)

with open(CLASS_TO_IDX_PATH, "r") as f:
    class_to_idx = json.load(f)
idx_to_class = {v: k for k, v in class_to_idx.items()}
target_classes = [idx_to_class[i] for i in range(len(class_to_idx))]

device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
print(f"Evaluation Device: {device} ({torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})")

# 1. Collect TEST set images (Untouched source)
test_paths = []
test_labels = []
valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

print(f"\nScanning untouched TEST directory: {TEST_DIR}")
for cls in target_classes:
    cls_dir = os.path.join(TEST_DIR, cls)
    if not os.path.exists(cls_dir):
        print(f"Warning: class folder '{cls}' not found in TEST")
        continue
    
    cls_idx = class_to_idx[cls]
    cnt = 0
    for dirpath, _, filenames in os.walk(cls_dir):
        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext in valid_exts:
                test_paths.append(os.path.join(dirpath, fname))
                test_labels.append(cls_idx)
                cnt += 1
    print(f"  {cls:30s}: {cnt:4d} test images")

print(f"Total TEST samples: {len(test_paths)}")

# 2. Dataset & DataLoader
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


# 3. Load Model
print("\nLoading trained model weights...")
checkpoint = torch.load(CHECKPOINT_PATH, map_location=device)
model = models.mobilenet_v3_large(weights=None)
in_features = model.classifier[3].in_features
model.classifier[3] = nn.Sequential(
    nn.Dropout(p=0.3, inplace=True),
    nn.Linear(in_features, len(target_classes))
)
model.load_state_dict(checkpoint["model_state_dict"])
model = model.to(device)
model.eval()

# 4. Evaluation Loop
all_preds = []
all_targets = []
all_probs = []

start_eval = time.time()
print("Running inference across TEST dataset...")

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

print(f"\nInference completed in {eval_time:.2f}s ({total_test/eval_time:.1f} images/sec).")
print(f"Overall TEST Accuracy: {test_accuracy * 100:.2f}% ({correct}/{total_test})")

# 5. Classification Report & Metrics
cls_report = classification_report(
    all_targets,
    all_preds,
    target_names=target_classes,
    digits=4,
    output_dict=True
)

print("\n" + "=" * 80)
print(f"{'Class':32s} | {'Precision':10s} | {'Recall':10s} | {'F1-Score':10s} | {'Support':8s}")
print("-" * 80)
for cls in target_classes:
    metrics = cls_report[cls]
    print(f"{cls:32s} | {metrics['precision']*100:9.2f}% | {metrics['recall']*100:9.2f}% | {metrics['f1-score']*100:9.2f}% | {int(metrics['support']):7d}")
print("-" * 80)
print(f"{'Macro Average':32s} | {cls_report['macro avg']['precision']*100:9.2f}% | {cls_report['macro avg']['recall']*100:9.2f}% | {cls_report['macro avg']['f1-score']*100:9.2f}% | {total_test:7d}")
print(f"{'Weighted Average':32s} | {cls_report['weighted avg']['precision']*100:9.2f}% | {cls_report['weighted avg']['recall']*100:9.2f}% | {cls_report['weighted avg']['f1-score']*100:9.2f}% | {total_test:7d}")
print("=" * 80)

# 6. Confusion Matrix
cm = confusion_matrix(all_targets, all_preds)

fig, ax = plt.subplots(figsize=(10, 8))
im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
ax.figure.colorbar(im, ax=ax)
ax.set(
    xticks=np.arange(cm.shape[1]),
    yticks=np.arange(cm.shape[0]),
    xticklabels=target_classes,
    yticklabels=target_classes,
    ylabel='True Civic Issue',
    xlabel='Predicted Civic Issue',
    title=f'Test Confusion Matrix (Accuracy: {test_accuracy*100:.2f}%)'
)
plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

# Loop over data dimensions and create text annotations
thresh = cm.max() / 2.
for i in range(cm.shape[0]):
    for j in range(cm.shape[1]):
        ax.text(j, i, format(cm[i, j], 'd'),
                ha="center", va="center",
                color="white" if cm[i, j] > thresh else "black")

fig.tight_layout()
cm_image_path = os.path.join(MODEL_DIR, "confusion_matrix.png")
plt.savefig(cm_image_path, dpi=200, bbox_inches='tight')
plt.close()

# Save JSON results
results = {
    "test_accuracy": float(test_accuracy),
    "correct": int(correct),
    "total": int(total_test),
    "classification_report": cls_report,
    "confusion_matrix": cm.tolist(),
    "evaluation_time_seconds": float(eval_time),
    "fps": float(total_test / eval_time),
    "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
}

with open(os.path.join(MODEL_DIR, "test_results.json"), "w") as f:
    json.dump(results, f, indent=2)

with open(os.path.join(MODEL_DIR, "classification_report.json"), "w") as f:
    json.dump(cls_report, f, indent=2)

print(f"\nSaved test results to {os.path.join(MODEL_DIR, 'test_results.json')}")
print(f"Saved confusion matrix plot to {cm_image_path}")
