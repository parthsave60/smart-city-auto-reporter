import os
import sys
import json
import time
import random
from pathlib import Path
from collections import Counter
import multiprocessing

# Ensure immediate unbuffered output in logs
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt

# ==========================================
# 1. REPRODUCIBILITY & GPU SETUP
# ==========================================
def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

# ==========================================
# 2. PATHS & CLASS DEFINITION
# ==========================================
DATASET_ROOT = r"C:\Users\Parth Save\Downloads\archive\civicIssues Dataset"
TRAIN_DIR = os.path.join(DATASET_ROOT, "TRAIN")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "models", "civic_issue_classifier")
os.makedirs(OUTPUT_DIR, exist_ok=True)

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

# ==========================================
# 3. DATASET CLASS & HELPER FUNCTIONS
# ==========================================
def collect_image_paths(root_dir, class_list):
    image_paths = []
    labels = []
    valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    for cls in class_list:
        cls_path = os.path.join(root_dir, cls)
        if not os.path.exists(cls_path):
            print(f"Warning: class folder '{cls}' not found in {root_dir}", flush=True)
            continue
        
        cls_idx = class_to_idx[cls]
        count = 0
        for dirpath, _, filenames in os.walk(cls_path):
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext in valid_exts:
                    image_paths.append(os.path.join(dirpath, fname))
                    labels.append(cls_idx)
                    count += 1
        print(f"Found {count:5d} images for class: '{cls}'", flush=True)

    return image_paths, labels

class CivicIssuesDataset(Dataset):
    def __init__(self, paths, labels, transform=None):
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
        
        if self.transform:
            image = self.transform(image)
        
        return image, label

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

train_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
    transforms.RandomRotation(degrees=10),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
])

val_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
])

# ==========================================
# 4. MAIN TRAINING EXECUTION
# ==========================================
def main():
    set_seed(42)

    print("=" * 60, flush=True)
    print("CIVIC ISSUE CLASSIFIER - TRAINING PIPELINE", flush=True)
    print("=" * 60, flush=True)
    print(f"PyTorch Version   : {torch.__version__}", flush=True)
    print(f"CUDA Available    : {torch.cuda.is_available()}", flush=True)
    if torch.cuda.is_available():
        print(f"Device Count      : {torch.cuda.device_count()}", flush=True)
        print(f"Active GPU        : {torch.cuda.get_device_name(0)}", flush=True)
        print(f"Total VRAM        : {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB", flush=True)
        device = torch.device("cuda:0")
    else:
        print("WARNING: CUDA not available, using CPU", flush=True)
        device = torch.device("cpu")
    print("=" * 60, flush=True)

    print("\nScanning TRAIN dataset...", flush=True)
    all_train_paths, all_train_labels = collect_image_paths(TRAIN_DIR, TARGET_CLASSES)
    total_samples = len(all_train_paths)
    print(f"Total images collected from TRAIN: {total_samples}", flush=True)

    # Stratified 85/15 train/val split
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        all_train_paths,
        all_train_labels,
        test_size=0.15,
        random_state=42,
        stratify=all_train_labels
    )

    print(f"Training split   : {len(train_paths)} images", flush=True)
    print(f"Validation split : {len(val_paths)} images", flush=True)

    # Class weights for handling class imbalance
    train_counts = Counter(train_labels)
    class_weights = []
    for idx in range(len(TARGET_CLASSES)):
        cnt = train_counts.get(idx, 1)
        class_weights.append(total_samples / (len(TARGET_CLASSES) * cnt))

    class_weights = np.array(class_weights)
    class_weights = class_weights / np.mean(class_weights)
    class_weights = np.clip(class_weights, 0.2, 10.0)
    class_weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)

    print("\nComputed Class Weights for Loss:", flush=True)
    for idx, cls in idx_to_class.items():
        print(f"  {cls:30s} (Train count: {train_counts.get(idx, 0):5d}): Weight = {class_weights[idx]:.3f}", flush=True)

    train_dataset = CivicIssuesDataset(train_paths, train_labels, transform=train_transforms)
    val_dataset = CivicIssuesDataset(val_paths, val_labels, transform=val_transforms)

    BATCH_SIZE = 64
    # On Windows, num_workers=0 avoids process spawning bottlenecks while running seamlessly
    NUM_WORKERS = 0

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=True if torch.cuda.is_available() else False
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=True if torch.cuda.is_available() else False
    )

    print("\nInitializing Pretrained MobileNetV3-Large...", flush=True)
    weights = models.MobileNet_V3_Large_Weights.DEFAULT
    model = models.mobilenet_v3_large(weights=weights)

    # Replace classification head for 9 civic issue classes
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, len(TARGET_CLASSES))
    )
    model = model.to(device)

    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-2)
    EPOCHS = 8
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
    
    # Modern PyTorch AMP GradScaler
    scaler = torch.amp.GradScaler('cuda') if torch.cuda.is_available() else None

    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
        "learning_rates": []
    }

    best_val_acc = 0.0
    best_epoch = 0
    patience = 4
    patience_counter = 0

    print(f"\nStarting Training on RTX 4060 GPU with Mixed Precision (AMP) for {EPOCHS} epochs...", flush=True)
    start_time = time.time()

    for epoch in range(1, EPOCHS + 1):
        epoch_start = time.time()
        
        # --- TRAINING ---
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for i, (images, labels) in enumerate(train_loader):
            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)

            if scaler:
                with torch.amp.autocast('cuda'):
                    outputs = model(images)
                    loss = criterion(outputs, labels)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                outputs = model(images)
                loss = criterion(outputs, labels)
                loss.backward()
                optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

            if (i + 1) % 100 == 0 or (i + 1) == len(train_loader):
                print(f"Epoch [{epoch}/{EPOCHS}] Step [{i+1}/{len(train_loader)}] Loss: {loss.item():.4f} Running Acc: {correct/total*100:.1f}%", flush=True)

        train_loss = running_loss / total
        train_acc = correct / total

        # --- VALIDATION ---
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device, non_blocking=True)
                labels = labels.to(device, non_blocking=True)
                if scaler:
                    with torch.amp.autocast('cuda'):
                        outputs = model(images)
                        loss = criterion(outputs, labels)
                else:
                    outputs = model(images)
                    loss = criterion(outputs, labels)

                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_correct += (preds == labels).sum().item()
                val_total += labels.size(0)

        val_loss = val_loss / val_total
        val_acc = val_correct / val_total
        current_lr = optimizer.param_groups[0]['lr']
        scheduler.step()

        history["train_loss"].append(float(train_loss))
        history["train_acc"].append(float(train_acc))
        history["val_loss"].append(float(val_loss))
        history["val_acc"].append(float(val_acc))
        history["learning_rates"].append(float(current_lr))

        epoch_duration = time.time() - epoch_start
        print(f"\n--- Epoch {epoch}/{EPOCHS} [{epoch_duration:.1f}s] ---", flush=True)
        print(f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}%", flush=True)
        print(f"Val Loss  : {val_loss:.4f} | Val Acc  : {val_acc*100:.2f}% | LR: {current_lr:.6f}", flush=True)

        # Checkpoint save
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            patience_counter = 0
            best_checkpoint_path = os.path.join(OUTPUT_DIR, "best_model.pth")
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_acc": float(val_acc),
                "val_loss": float(val_loss),
                "class_to_idx": class_to_idx,
                "idx_to_class": idx_to_class,
                "target_classes": TARGET_CLASSES,
                "architecture": "mobilenet_v3_large"
            }, best_checkpoint_path)
            print(f">> BEST MODEL SAVED (Val Acc: {val_acc*100:.2f}%) at {best_checkpoint_path}", flush=True)
        else:
            patience_counter += 1
            print(f"Patience: {patience_counter}/{patience}", flush=True)
            if patience_counter >= patience:
                print(f"\nEarly stopping triggered after {epoch} epochs!", flush=True)
                break

    total_training_time = time.time() - start_time
    print(f"\nTraining completed in {total_training_time/60:.2f} minutes.", flush=True)
    print(f"Best Validation Accuracy: {best_val_acc*100:.2f}% at Epoch {best_epoch}", flush=True)

    # Save configs & metadata
    with open(os.path.join(OUTPUT_DIR, "class_to_idx.json"), "w") as f:
        json.dump(class_to_idx, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "idx_to_class.json"), "w") as f:
        json.dump(idx_to_class, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "class_to_issue_type.json"), "w") as f:
        json.dump(CLASS_TO_ISSUE_TYPE, f, indent=2)

    model_config = {
        "architecture": "mobilenet_v3_large",
        "num_classes": len(TARGET_CLASSES),
        "classes": TARGET_CLASSES,
        "input_size": [3, 224, 224],
        "mean": IMAGENET_MEAN,
        "std": IMAGENET_STD,
        "confidence_threshold": 0.55,
        "best_epoch": best_epoch,
        "best_val_acc": float(best_val_acc),
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    with open(os.path.join(OUTPUT_DIR, "model_config.json"), "w") as f:
        json.dump(model_config, f, indent=2)

    with open(os.path.join(OUTPUT_DIR, "training_metrics.json"), "w") as f:
        json.dump(history, f, indent=2)

    # Save training curve plots
    try:
        plt.figure(figsize=(12, 5))
        plt.subplot(1, 2, 1)
        plt.plot(history["train_loss"], label="Train Loss", marker='o')
        plt.plot(history["val_loss"], label="Val Loss", marker='s')
        plt.xlabel("Epoch")
        plt.ylabel("Loss")
        plt.title("Training & Validation Loss")
        plt.legend()
        plt.grid(True)

        plt.subplot(1, 2, 2)
        plt.plot([acc * 100 for acc in history["train_acc"]], label="Train Accuracy", marker='o')
        plt.plot([acc * 100 for acc in history["val_acc"]], label="Val Accuracy", marker='s')
        plt.xlabel("Epoch")
        plt.ylabel("Accuracy (%)")
        plt.title("Training & Validation Accuracy")
        plt.legend()
        plt.grid(True)

        plt.tight_layout()
        plt.savefig(os.path.join(OUTPUT_DIR, "training_curves.png"), dpi=200)
        plt.close()
    except Exception as e:
        print(f"Warning: Plot generation error: {e}", flush=True)

    print(f"Artifacts successfully saved to: {OUTPUT_DIR}", flush=True)

if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
