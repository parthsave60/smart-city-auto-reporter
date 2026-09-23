"""
Multimodal Vision API - Independent Validation & Waterlogging Detection Layer

This module provides a completely separate multimodal vision validation layer.
It does NOT modify, retrain, or alter the custom 9-class civic issue classification model.

Flow:
1. Validates image clarity (identifies blurry / degraded images).
2. Detects Waterlogging & road flooding through visual reflection and hydrological scene analysis.
3. Detects non-civic images (selfies, food, pets, indoor items, screens, documents).
4. Verifies whether an image contains a legitimate civic issue.
"""

import io
import math
import base64
import urllib.request
import numpy as np
from PIL import Image
import torch
import torchvision.transforms as T
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights

# Non-civic ImageNet category keywords (food, pets, indoor furniture, office, electronics)
CIVIC_OUTDOOR_KEYWORDS = {
    'street', 'road', 'traffic', 'car', 'cab', 'truck', 'bus', 'vehicle',
    'curb', 'sidewalk', 'pavement', 'asphalt', 'bridge', 'viaduct', 'pier',
    'pole', 'sign', 'fence', 'tree', 'park', 'grass', 'building', 'structure',
    'lakeside', 'seashore', 'breakwater', 'dam', 'dike', 'fountain', 'geyser',
    'drain', 'puddle', 'flood', 'water', 'cliff', 'volcano', 'valley',
    'ashcan', 'garbage', 'trash', 'crate', 'dumpster', 'barrel', 'wall', 'street sign'
}

NON_CIVIC_KEYWORDS = {
    'dog', 'cat', 'terrier', 'hound', 'retriever', 'spaniel', 'poodle', 'bird', 'pug', 'beagle',
    'bulldog', 'collie', 'shepherd', 'rottweiler', 'boxer', 'chihuahua', 'husky', 'dalmatian',
    'tabby', 'siamese', 'persian', 'egyptian_cat', 'tiger_cat', 'hamster', 'rabbit', 'guinea_pig',
    'pizza', 'burger', 'cheeseburger', 'sandwich', 'hotdog', 'ice_cream', 'soup', 'bread', 'bagel',
    'pretzel', 'taco', 'burrito', 'french_loaf', 'potpie', 'guacamole', 'consomme', 'espresso',
    'coffee_mug',
    'desk', 'chair', 'sofa', 'wardrobe', 'bed', 'pillow', 'bookcase', 'couch', 'rocking_chair',
    'laptop', 'mouse', 'keyboard', 'cellular_telephone', 'television', 'monitor', 'screen', 'web_site',
    'digital_clock', 'oscilloscope',
    'hand-held_computer', 'typewriter_keyboard',
    'suit', 'tie', 'wig', 'sunglasses', 'jersey', 'lipstick', 'hair_spray', 'sock', 'shoe',
    'band_aid', 'wall_clock', 'analog_clock',
    'teddy', 'toy', 'balloon', 'wallet', 'toilet',
    'microwave', 'refrigerator', 'washer', 'dishwasher', 'toaster', 'vacuum', 'iron'
}

WATER_IMAGENET_CLASSES = {
    'lakeside', 'seashore', 'fountain', 'geyser', 'lifeboat', 'fireboat',
    'canoe', 'gondola', 'speedboat', 'boathouse'
}

class MultimodalVisionValidator:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.weights = MobileNet_V3_Large_Weights.DEFAULT
        self.model = mobilenet_v3_large(weights=self.weights).to(self.device).eval()
        self.categories = self.weights.meta['categories']
        self.preprocess = self.weights.transforms()
        print(f"[MultimodalVision] Initialized validator on device: {self.device}")

    def load_image(self, image_input):
        if isinstance(image_input, Image.Image):
            return image_input.convert('RGB')
        
        if isinstance(image_input, bytes):
            return Image.open(io.BytesIO(image_input)).convert('RGB')
            
        if isinstance(image_input, str):
            if image_input.startswith(('http://', 'https://')):
                import ssl
                ctx = ssl._create_unverified_context()
                req = urllib.request.Request(
                    image_input,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                    }
                )
                with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                    return Image.open(io.BytesIO(resp.read())).convert('RGB')
            
            # Base64 string
            b64_str = image_input
            if ',' in b64_str:
                b64_str = b64_str.split(',', 1)[1]
            raw_bytes = base64.b64decode(b64_str)
            return Image.open(io.BytesIO(raw_bytes)).convert('RGB')

        raise ValueError("Unsupported image input type")

    def check_image_clarity(self, pil_img):
        """
        Check for severe blur, pitch darkness, or overexposure.
        Returns (is_unclear, reason_message)
        """
        # Resize to standard analysis size for consistent blur measurement
        resized = pil_img.resize((256, 256)).convert('L')
        arr = np.array(resized, dtype=np.float32)

        # 1. Darkness / Overexposure check
        mean_brightness = np.mean(arr)
        if mean_brightness < 12.0:
            return True, "Image is too dark to identify infrastructure defects."
        if mean_brightness > 250.0:
            return True, "Image is overexposed and washed out."

        # 2. Gradient / Edge sharpness check (Laplacian variance approximation)
        gx = np.diff(arr, axis=1)
        gy = np.diff(arr, axis=0)
        edge_variance = float(np.var(gx) + np.var(gy))

        # Very low edge variance indicates out-of-focus or completely flat degraded images
        if edge_variance < 12.0:
            return True, "Image is blurry or lacks sufficient visual detail."

        return False, None

    def analyze_waterlogging_features(self, pil_img):
        """
        Hydrological visual analysis: analyzes water pooling, surface reflection,
        horizontal specular highlights, and drainage characteristics in road scenes.
        """
        w, h = pil_img.size
        # Water accumulation in civic scenes predominantly settles in bottom 65% of roadway
        lower_region = pil_img.crop((0, int(h * 0.35), w, h)).resize((128, 128))
        img_np = np.array(lower_region, dtype=np.float32) / 255.0

        # RGB channels
        r = img_np[:, :, 0]
        g = img_np[:, :, 1]
        b = img_np[:, :, 2]

        # Specular reflection highlights (bright saturated water highlights reflecting overcast sky)
        luminance = 0.299 * r + 0.587 * g + 0.114 * b
        specular_mask = (luminance > 0.75) & (np.abs(r - b) < 0.15) & (np.abs(g - b) < 0.15)
        specular_ratio = np.mean(specular_mask)

        # Flatness / low texture gradient on water surface (water creates mirror-like flat pooling)
        gx = np.abs(np.diff(luminance, axis=1)) # (128, 127)
        gy = np.abs(np.diff(luminance, axis=0)) # (127, 128)
        flat_surface_ratio = float(np.mean((gx[:-1, :] < 0.04) & (gy[:, :-1] < 0.04)))

        # Water color tone (slight blue-gray or muddy brown overcast water)
        blue_overcast = (b > r) & (g > r * 0.9)
        muddy_water = (r > b * 1.05) & (g > b * 0.95) & (luminance > 0.25) & (luminance < 0.65)
        water_tone_ratio = np.mean(blue_overcast | muddy_water)

        # Composite score
        water_score = (specular_ratio * 3.5) + (flat_surface_ratio * 0.5) + (water_tone_ratio * 0.4)
        return min(max(water_score, 0.0), 1.0), float(specular_ratio), float(flat_surface_ratio)

    def check_is_screenshot(self, pil_img, top5_classes, has_civic_context=False):
        """
        Detects digital screenshots (websites, desktop apps, code editors, documents, UI graphics).
        Does NOT falsely flag real trash packets/cartons or asphalt roads as screenshots.
        """
        SCREENSHOT_CLASSES = {
            'web_site', 'monitor', 'screen', 'television', 'digital_clock',
            'hand-held_computer', 'oscilloscope', 'cellular_telephone'
        }
        if any(any(sc in c.lower() for sc in SCREENSHOT_CLASSES) for c in top5_classes[:2]):
            return True, "Image is a digital screen or document capture with no outdoor civic issue."

        resized = pil_img.resize((128, 128)).convert('RGB')
        arr = np.array(resized, dtype=np.float32)

        # Check for solid background / synthetic canvas (white, dark mode, or flat gray)
        is_pure_white = np.all(arr > 242.0, axis=-1)
        is_dark_theme = np.all(arr < 25.0, axis=-1)
        is_flat_gray = (np.abs(arr[:, :, 0] - arr[:, :, 1]) < 4.0) & \
                       (np.abs(arr[:, :, 1] - arr[:, :, 2]) < 4.0) & \
                       (arr[:, :, 0] > 200.0) & (arr[:, :, 0] < 235.0)
        
        canvas_ratio = np.mean(is_pure_white | is_dark_theme | is_flat_gray)
        if canvas_ratio > 0.55 and not has_civic_context:
            return True, "Image contains a synthetic canvas or digital screenshot with no civic issue."

        return False, None

    def validate(self, image_input, classifier_result=None):
        """
        Validate image using Multimodal Vision logic.
        Returns:
        {
            "civicIssueDetected": bool,
            "category": str or None,
            "issueTypeId": str or None,
            "confidence": float,
            "isUnclear": bool,
            "message": str or None,
            "source": "multimodal_vision"
        }
        """
        try:
            pil_img = self.load_image(image_input)
        except Exception as err:
            return {
                "civicIssueDetected": False,
                "isUnclear": True,
                "category": None,
                "issueTypeId": None,
                "confidence": 0.0,
                "message": "Unable to verify a civic issue. Please upload a clearer image.",
                "source": "multimodal_vision"
            }

        # 1. Check clarity / degradation first
        is_unclear, clarity_msg = self.check_image_clarity(pil_img)
        if is_unclear:
            return {
                "civicIssueDetected": False,
                "isUnclear": True,
                "category": "None",
                "issueTypeId": None,
                "confidence": 0.0,
                "reason": clarity_msg or "Unable to verify a civic issue. Please upload a clearer image.",
                "reasoning": clarity_msg or "Unable to verify a civic issue. Please upload a clearer image.",
                "message": "Unable to verify a civic issue. Please upload a clearer image.",
                "source": "multimodal_vision"
            }

        # Automatically query custom classifier if classifier_result was not passed
        if classifier_result is None:
            try:
                from services.classifier.inference import get_classifier_service
                classifier_result = get_classifier_service().predict(pil_img)
            except Exception as e:
                classifier_result = None

        has_custom_civic_prediction = False
        custom_class = None
        custom_conf = 0.0
        custom_type = 'other'
        if classifier_result:
            custom_conf = classifier_result.get("confidence", 0.0)
            custom_uncertain = classifier_result.get("isUncertain", False)
            custom_class = classifier_result.get("predictedClass")
            custom_type = classifier_result.get("issueTypeId")
            if (custom_conf >= 0.40 and not custom_uncertain and custom_class and 
                custom_class not in ('Unspecified', 'other', 'Civic Issue', 'Civic Issue (Inspection Needed)', 'None', 'Uncertain / Other')):
                has_custom_civic_prediction = True

        # 2. Extract deep multimodal scene features with ImageNet backbone
        tensor = self.preprocess(pil_img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            top5_probs, top5_indices = torch.topk(probs, 5)

        top5_classes = [self.categories[idx.item()] for idx in top5_indices]
        top5_scores = [prob.item() for prob in top5_probs]

        has_street_or_outdoor_context = any(
            any(kw in c.lower() for kw in CIVIC_OUTDOOR_KEYWORDS)
            for c in top5_classes
        )
        has_civic_context = has_street_or_outdoor_context or has_custom_civic_prediction

        # 3. Check for Digital Screenshots / UI Captures
        is_screenshot, sc_reason = self.check_is_screenshot(pil_img, top5_classes, has_civic_context=has_civic_context)
        if is_screenshot:
            return {
                "civicIssueDetected": False,
                "isUnclear": False,
                "category": "None",
                "issueTypeId": None,
                "confidence": 0.96,
                "reason": sc_reason or "The image is a digital screenshot or document with no visible civic issue.",
                "reasoning": sc_reason or "The image is a digital screenshot or document with no visible civic issue.",
                "message": "No civic issue detected in this image. Please upload an image showing a valid civic issue.",
                "source": "multimodal_vision"
            }

        # 4. Check for Non-Civic objects (selfie, food, pets, indoor furniture, personal electronics)
        # Pet and prepared food classes are strictly non-civic
        non_civic_score = sum(
            prob for c, prob in zip(top5_classes, top5_scores)
            if any(kw in c.lower() for kw in NON_CIVIC_KEYWORDS)
        )
        top1_is_non_civic = any(kw in top5_classes[0].lower() for kw in NON_CIVIC_KEYWORDS)

        # High confidence non-civic object (e.g. food/pizza/dog > 0.35, or clear top1 with low civic context)
        is_strictly_non_civic = False
        if top1_is_non_civic and non_civic_score > 0.30 and not has_street_or_outdoor_context:
            is_strictly_non_civic = True
        elif non_civic_score > 0.45 and not has_street_or_outdoor_context:
            is_strictly_non_civic = True

        if is_strictly_non_civic:
            return {
                "civicIssueDetected": False,
                "isUnclear": False,
                "category": "None",
                "issueTypeId": None,
                "confidence": 0.0,
                "reason": "The image shows non-civic content (food, pet, indoor object, or personal item).",
                "reasoning": "The image shows non-civic content (food, pet, indoor object, or personal item).",
                "message": "No civic issue detected in this image. Please upload an image showing a valid civic issue.",
                "source": "multimodal_vision",
                "details": {
                    "topClass": top5_classes[0],
                    "nonCivicScore": round(non_civic_score, 3)
                }
            }

        # 5. Check for Waterlogging & Road Flooding
        water_visual_score, specular_ratio, flat_surface_ratio = self.analyze_waterlogging_features(pil_img)
        water_class_match = any(
            any(w_cls in c.lower() for w_cls in WATER_IMAGENET_CLASSES) 
            for c in top5_classes[:2]
        )

        is_waterlogging = False
        water_confidence = 0.0
        # Genuine waterlogging requires water/flood scene context and hydrological visual evidence
        if water_class_match and water_visual_score >= 0.35:
            is_waterlogging = True
            water_confidence = max(0.88, min(0.75 + (water_visual_score * 0.25), 0.96))
        elif water_class_match and any(w in top5_classes[0].lower() for w in ['canoe', 'paddle', 'speedboat', 'boat', 'water', 'lake', 'flood']):
            is_waterlogging = True
            water_confidence = 0.88

        if is_waterlogging:
            return {
                "civicIssueDetected": True,
                "isUnclear": False,
                "category": "Waterlogging",
                "issueTypeId": "waterlogging",
                "confidence": float(round(water_confidence, 2)),
                "reason": "The image clearly shows a road covered with standing water and street flooding.",
                "reasoning": "Road waterlogging, flooded street, and standing water accumulation detected on public infrastructure.",
                "message": None,
                "source": "multimodal_vision"
            }

        # 6. Check if the 9-class custom model has confidently classified this into one of the 9 classes
        if has_custom_civic_prediction:
            return {
                "civicIssueDetected": True,
                "isUnclear": False,
                "category": custom_class,
                "issueTypeId": custom_type or 'other',
                "confidence": float(round(custom_conf, 2)),
                "reason": f"Confirmed {custom_class} on public infrastructure.",
                "reasoning": f"Confirmed {custom_class} on public infrastructure.",
                "message": None,
                "source": "custom_model"
            }

        # 7. If neither system can verify a civic issue
        return {
            "civicIssueDetected": False,
            "isUnclear": False,
            "category": "None",
            "issueTypeId": None,
            "confidence": 0.0,
            "reason": "The image does not show a recognizable civic issue.",
            "reasoning": "The image does not show a recognizable civic issue.",
            "message": "No civic issue detected in this image. Please upload an image showing a valid civic issue.",
            "source": "multimodal_vision"
        }

_validator_instance = None

def get_multimodal_validator():
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = MultimodalVisionValidator()
    return _validator_instance
