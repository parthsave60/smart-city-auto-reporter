import os
import sys
import json
import time
import random
import argparse
from pathlib import Path
from collections import Counter

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
from sklearn.metrics import classification_report, f1_score

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

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

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
            image = Image.new("RGB", (288, 288), (128, 128, 128))
        if self.transform:
            image = self.transform(image)
        return image, label

# Higher input resolution: 288x288 (Resize to 320, Crop to 288)
train_transforms = transforms.Compose([
    transforms.Resize(320),
    transforms.RandomResizedCrop(288, scale=(0.85, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.ColorJitter(brightness=0.10, contrast=0.10, saturation=0.10),
    transforms.RandomRotation(degrees=6),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
])

val_transforms = transforms.Compose([
    transforms.Resize(320),
    transforms.CenterCrop(288),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
])

def get_or_create_splits(dataset_root, cache_path):
    if os.path.exists(cache_path):
        with open(cache_path, "r") as f:
            data = json.load(f)
        return data["train_paths"], data["val_paths"], data["train_labels"], data["val_labels"]

    train_dir = os.path.join(dataset_root, "TRAIN")
    image_paths = []
    labels = []
    valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    for cls in TARGET_CLASSES:
        cls_dir = os.path.join(train_dir, cls)
        if not os.path.exists(cls_dir):
            continue
        c_idx = class_to_idx[cls]
        for dirpath, _, filenames in os.walk(cls_dir):
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext in valid_exts:
                    image_paths.append(os.path.join(dirpath, fname))
                    labels.append(c_idx)

    train_paths, val_paths, train_labels, val_labels = train_test_split(
        image_paths,
        labels,
        test_size=0.15,
        random_state=42,
        stratify=labels
    )

    with open(cache_path, "w") as f:
        json.dump({
            "train_paths": train_paths,
            "val_paths": val_paths,
            "train_labels": train_labels,
            "val_labels": val_labels
        }, f)

    return train_paths, val_paths, train_labels, val_labels

def build_model(device):
    model = models.mobilenet_v3_large(weights=None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(
        nn.Dropout(p=0.3, inplace=True),
        nn.Linear(in_features, len(TARGET_CLASSES))
    )
    return model.to(device)

def main():
    parser = argparse.ArgumentParser(description="Continue training existing 9-class model")
    parser.add_argument("--epoch", type=int, required=True, help="Current continued epoch (1-20)")
    parser.add_argument("--total-epochs", type=int, default=20, help="Total additional epochs (20)")
    parser.add_argument("--batch-size", type=int, default=48, help="Batch size for 288x288")
    parser.add_argument("--lr", type=float, default=6e-5, help="Fine-tuning learning rate")
    parser.add_argument("--source-checkpoint", type=str, default=r"models\civic_issue_classifier\best_model.pth")
    parser.add_argument("--dataset-root", type=str, default=r"C:\Users\Parth Save\Downloads\archive\civicIssues Dataset")
    parser.add_argument("--output-dir", type=str, default=r"models\civic_issue_classifier_continued")
    args = parser.parse_args()

    set_seed(100 + args.epoch)
    os.makedirs(args.output_dir, exist_ok=True)

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    cache_path = os.path.join(args.output_dir, "split_cache.json")
    state_path = os.path.join(args.output_dir, "training_state.pt")
    best_checkpoint_path = os.path.join(args.output_dir, "best_model.pth")

    train_paths, val_paths, train_labels, val_labels = get_or_create_splits(args.dataset_root, cache_path)

    # Balanced class weights (square-root inverse)
    total_samples = len(train_labels)
    train_counts = Counter(train_labels)
    raw_weights = []
    for idx in range(len(TARGET_CLASSES)):
        cnt = train_counts.get(idx, 1)
        raw_weights.append(np.sqrt(total_samples / cnt))
    raw_weights = np.array(raw_weights)
    norm_weights = raw_weights / np.mean(raw_weights)
    norm_weights = np.clip(norm_weights, 0.4, 4.0)
    class_weights_tensor = torch.tensor(norm_weights, dtype=torch.float32).to(device)

    train_dataset = CivicIssuesDataset(train_paths, train_labels, transform=train_transforms)
    val_dataset = CivicIssuesDataset(val_paths, val_labels, transform=val_transforms)

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=torch.cuda.is_available()
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=torch.cuda.is_available()
    )

    model = build_model(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor, label_smoothing=0.02)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.total_epochs, eta_min=1e-6)
    scaler = torch.amp.GradScaler('cuda') if torch.cuda.is_available() else None

    best_val_f1 = 0.0
    best_val_acc = 0.0
    best_epoch = 0
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "val_f1": []}

    if args.epoch == 1:
        # VERIFY AND PRINT CONFIRMATION
        print("=" * 80, flush=True)
        print(f"Loading learned weights from source checkpoint: {args.source_checkpoint}", flush=True)
        if not os.path.exists(args.source_checkpoint):
            raise FileNotFoundError(f"Source checkpoint {args.source_checkpoint} does not exist!")
        src_state = torch.load(args.source_checkpoint, map_location=device)
        model.load_state_dict(src_state["model_state_dict"])
        print(f"Source checkpoint loaded: Epoch {src_state.get('epoch', 'N/A')}, Val Acc: {src_state.get('val_acc', 'N/A')}", flush=True)
        print("Continuing training from existing trained model — NOT training from scratch.", flush=True)
        print(f"Higher Resolution Active: 288x288 (Resize 320 -> Crop 288) on {device}", flush=True)
        print("=" * 80, flush=True)
    else:
        # Resume from continued training state
        if os.path.exists(state_path):
            state = torch.load(state_path, map_location=device)
            model.load_state_dict(state["model_state_dict"])
            optimizer.load_state_dict(state["optimizer_state_dict"])
            scheduler.load_state_dict(state["scheduler_state_dict"])
            if scaler and state.get("scaler_state_dict"):
                scaler.load_state_dict(state["scaler_state_dict"])
            best_val_f1 = state.get("best_val_f1", 0.0)
            best_val_acc = state.get("best_val_acc", 0.0)
            best_epoch = state.get("best_epoch", 0)
            history = state.get("history", history)

    # --- TRAIN ONE EPOCH ---
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    t0 = time.time()
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

        if (i + 1) % 200 == 0 or (i + 1) == len(train_loader):
            print(f"Epoch [{args.epoch}/{args.total_epochs}] Step [{i+1}/{len(train_loader)}] Loss: {loss.item():.4f} Running Acc: {correct/total*100:.2f}%", flush=True)

    train_loss = running_loss / total
    train_acc = correct / total

    # --- VALIDATION ---
    model.eval()
    val_loss = 0.0
    all_preds = []
    all_targets = []

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
            all_preds.extend(preds.cpu().numpy().tolist())
            all_targets.extend(labels.cpu().numpy().tolist())

    val_loss = val_loss / len(all_targets)
    val_correct = sum(p == t for p, t in zip(all_preds, all_targets))
    val_acc = val_correct / len(all_targets)
    val_macro_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)
    scheduler.step()

    report = classification_report(all_targets, all_preds, target_names=TARGET_CLASSES, output_dict=True, zero_division=0)

    is_best = False
    if val_macro_f1 > best_val_f1:
        best_val_f1 = val_macro_f1
        best_val_acc = val_acc
        best_epoch = args.epoch
        is_best = True

        torch.save({
            "epoch": args.epoch,
            "continued_epoch": args.epoch,
            "source_model": args.source_checkpoint,
            "resolution": [3, 288, 288],
            "model_state_dict": model.state_dict(),
            "val_acc": float(val_acc),
            "val_f1": float(val_macro_f1),
            "val_loss": float(val_loss),
            "class_to_idx": class_to_idx,
            "idx_to_class": idx_to_class,
            "target_classes": TARGET_CLASSES,
            "architecture": "mobilenet_v3_large"
        }, best_checkpoint_path)

    history["train_loss"].append(float(train_loss))
    history["train_acc"].append(float(train_acc))
    history["val_loss"].append(float(val_loss))
    history["val_acc"].append(float(val_acc))
    history["val_f1"].append(float(val_macro_f1))

    # Save state
    torch.save({
        "epoch": args.epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "scaler_state_dict": scaler.state_dict() if scaler else None,
        "best_val_f1": float(best_val_f1),
        "best_val_acc": float(best_val_acc),
        "best_epoch": int(best_epoch),
        "history": history
    }, state_path)

    with open(os.path.join(args.output_dir, "training_metrics.json"), "w") as f:
        json.dump(history, f, indent=2)

    duration = time.time() - t0
    print(f"\n--- CONTINUED EPOCH {args.epoch}/{args.total_epochs} FINISHED in {duration:.1f}s (Best: Epoch {best_epoch}, Val F1: {best_val_f1:.4f}) ---", flush=True)

    summary_data = {
        "epoch": args.epoch,
        "total_epochs": args.total_epochs,
        "train_loss": round(train_loss, 4),
        "val_loss": round(val_loss, 4),
        "train_acc": round(train_acc * 100, 2),
        "val_acc": round(val_acc * 100, 2),
        "val_f1": round(val_macro_f1, 4),
        "is_best": is_best,
        "best_epoch": best_epoch,
        "best_val_f1": round(best_val_f1, 4)
    }

    with open(os.path.join(args.output_dir, f"epoch_{args.epoch}_summary.json"), "w") as f:
        json.dump(summary_data, f, indent=2)

    print("\n========================================", flush=True)
    print("CONTINUED_EPOCH_SUMMARY_START", flush=True)
    print(json.dumps(summary_data), flush=True)
    print("CONTINUED_EPOCH_SUMMARY_END", flush=True)
    print("========================================\n", flush=True)

if __name__ == "__main__":
    main()
