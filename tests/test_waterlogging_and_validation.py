import os
import sys
import json
import urllib.request
import urllib.parse
from pathlib import Path
from PIL import Image
import numpy as np

# Ensure root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

API_BASE = "http://localhost:8000"

def post_json(endpoint, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{API_BASE}{endpoint}",
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(endpoint):
    req = urllib.request.Request(f"{API_BASE}{endpoint}")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=================================================================")
print("RUNNING FINAL VERIFICATION FOR WATERLOGGING & CIVIC ISSUE VALIDATION")
print("=================================================================")

# Test 7: Verify custom model has strictly 9 classes, NO waterlogging in model classes
classes_res = get_json("/api/classes")
model_classes = [c['className'] for c in classes_res['classes']]
print("\n[TEST 7] Custom Model Class List Check:")
print(f"Total model classes: {len(model_classes)}")
print(f"Model classes: {model_classes}")
assert len(model_classes) == 9, f"Expected 9 classes, got {len(model_classes)}"
assert "Waterlogging" not in model_classes, "Waterlogging MUST NOT be in the custom model classes!"
assert "waterlogging" not in [c.lower() for c in model_classes], "Waterlogging found in model classes!"
print(">>> PASS: Custom 9-class model is completely unchanged with exactly 9 classes and NO Waterlogging.")

# Test 1: Garbage images (multiple images from real dataset)
dataset_dir = r"C:\Users\Parth Save\Downloads\archive\civicIssues Dataset\TEST"
garbage_dir = os.path.join(dataset_dir, "Garbage")
garbage_imgs = []
for root, _, files in os.walk(garbage_dir):
    for f in files:
        if f.lower().endswith(('.jpg', '.png')):
            garbage_imgs.append(os.path.join(root, f))
            if len(garbage_imgs) >= 3:
                break
    if len(garbage_imgs) >= 3:
        break

from services.classifier.inference import get_classifier_service
from services.classifier.multimodal_vision import get_multimodal_validator

classifier = get_classifier_service()
validator = get_multimodal_validator()

print("\n[TEST 1] Garbage Images (Batch Check):")
for gpath in garbage_imgs:
    g_img = Image.open(gpath).convert('RGB')
    c_res_g = classifier.predict(g_img)
    v_res_g = validator.validate(g_img, c_res_g)
    print(f"  File: {os.path.basename(gpath)[:40]} -> Model: {c_res_g['predictedClass']} ({c_res_g['confidence']:.2f}), Validation: detected={v_res_g['civicIssueDetected']}, category={v_res_g['category']}")
    assert c_res_g['predictedClass'] == 'Garbage', f"Expected Garbage, got {c_res_g['predictedClass']}"
    assert v_res_g['civicIssueDetected'] is True, f"Garbage image {os.path.basename(gpath)} should be accepted as valid civic issue"
    assert v_res_g['category'] == 'Garbage', f"Expected category Garbage, got {v_res_g['category']}"
print(">>> PASS: All Garbage images correctly accepted as Garbage.")

# Test 2: Pothole images (multiple images from real dataset, both with and without c_res passed)
pothole_dir = os.path.join(dataset_dir, "Potholes and RoadCracks")
pothole_imgs = []
for root, _, files in os.walk(pothole_dir):
    for f in files:
        if f.lower().endswith(('.jpg', '.png')):
            pothole_imgs.append(os.path.join(root, f))
            if len(pothole_imgs) >= 3:
                break
    if len(pothole_imgs) >= 3:
        break

print("\n[TEST 2] Pothole Images (Batch Check):")
for ppath in pothole_imgs:
    p_img = Image.open(ppath).convert('RGB')
    c_res_p = classifier.predict(p_img)
    v_res_p_with = validator.validate(p_img, c_res_p)
    v_res_p_auto = validator.validate(p_img, None)
    print(f"  File: {os.path.basename(ppath)[:40]} -> Model: {c_res_p['predictedClass']} ({c_res_p['confidence']:.2f})")
    print(f"     With c_res: detected={v_res_p_with['civicIssueDetected']}, cat={v_res_p_with['category']}")
    print(f"     Auto c_res: detected={v_res_p_auto['civicIssueDetected']}, cat={v_res_p_auto['category']}")
    assert c_res_p['predictedClass'] == 'Potholes and RoadCracks', f"Expected Potholes and RoadCracks, got {c_res_p['predictedClass']}"
    assert v_res_p_with['civicIssueDetected'] is True, "Potholes should be detected as valid civic issue"
    assert v_res_p_with['category'] == 'Potholes and RoadCracks', f"Expected category Potholes and RoadCracks, got {v_res_p_with['category']}"
    assert v_res_p_auto['civicIssueDetected'] is True, "Potholes should be detected even when classifier_result is None"
    assert v_res_p_auto['category'] == 'Potholes and RoadCracks', f"Expected category Potholes and RoadCracks, got {v_res_p_auto['category']}"
print(">>> PASS: Pothole images correctly accepted as Potholes and RoadCracks with and without explicit c_res.")

# Test 3: Waterlogged road image
water_url = "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500"
water_req = urllib.request.Request(water_url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(water_req, timeout=10) as resp:
    water_img = Image.open(resp).convert('RGB')

# Waterlogging API validation
v_res_water = validator.validate(water_img, None)
print("\n[TEST 3] Waterlogged Road Image:")
print(f"Multimodal Vision API Output: {v_res_water}")
assert v_res_water['civicIssueDetected'] is True, "Waterlogged road must be detected as valid civic issue"
assert v_res_water['category'] == 'Waterlogging', f"Expected category Waterlogging, got {v_res_water['category']}"
assert v_res_water['confidence'] >= 0.70, f"Confidence should be >= 0.70, got {v_res_water['confidence']}"
print(">>> PASS: Waterlogging detected via separate API layer; category=Waterlogging, report allowed.")

# Test 4: Normal / non-civic image (Pizza food)
food_url = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400"
food_req = urllib.request.Request(food_url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(food_req, timeout=10) as resp:
    food_img = Image.open(resp).convert('RGB')

c_res_food = classifier.predict(food_img)
v_res_food = validator.validate(food_img, c_res_food)
print("\n[TEST 4] Non-Civic Image (Pizza Food):")
print(f"9-Class Model raw guess: {c_res_food['predictedClass']} ({c_res_food['confidence']:.2f})")
print(f"Multimodal Vision API Output: {v_res_food}")
assert v_res_food['civicIssueDetected'] is False, "Non-civic image must NOT be detected as a civic issue"
assert v_res_food['message'] == "No civic issue detected in this image. Please upload an image showing a valid civic issue.", \
    f"Message mismatch: {v_res_food['message']}"
print(">>> PASS: Non-civic image rejected with exact required message; submission blocked.")

# Test 5: Unclear / degraded image (pitch dark and pure blur)
dark_img = Image.fromarray(np.zeros((224, 224, 3), dtype=np.uint8))
c_res_dark = classifier.predict(dark_img)
v_res_dark = validator.validate(dark_img, c_res_dark)
print("\n[TEST 5] Unclear Image (Pitch Dark):")
print(f"Multimodal Vision API Output: {v_res_dark}")
assert v_res_dark['civicIssueDetected'] is False, "Unclear image must NOT be detected as civic issue"
assert v_res_dark['isUnclear'] is True, "isUnclear flag must be True"
assert v_res_dark['message'] == "Unable to verify a civic issue. Please upload a clearer image.", \
    f"Message mismatch: {v_res_dark['message']}"
print(">>> PASS: Unclear image rejected with exact required message; submission blocked.")

# Test 8: Normal Screenshot (Website / Desktop UI with no civic issue)
screenshot_arr = np.full((300, 400, 3), 255, dtype=np.uint8)
screenshot_arr[:40, :] = [30, 41, 59] # dark navbar
screenshot_arr[40:, :80] = [241, 245, 249] # light gray sidebar
screenshot_img = Image.fromarray(screenshot_arr)
c_res_screenshot = classifier.predict(screenshot_img)
v_res_screenshot = validator.validate(screenshot_img, c_res_screenshot)
print("\n[TEST 8] Normal Screenshot (Website / Desktop UI):")
print(f"9-Class Model raw guess: {c_res_screenshot['predictedClass']} ({c_res_screenshot['confidence']:.2f})")
print(f"Multimodal Vision API Output: {v_res_screenshot}")
assert v_res_screenshot['civicIssueDetected'] is False, "Normal screenshot must NOT be detected as civic issue"
assert v_res_screenshot['category'] == 'None', f"Expected category 'None', got {v_res_screenshot['category']}"
assert v_res_screenshot['message'] == "No civic issue detected in this image. Please upload an image showing a valid civic issue."
print(">>> PASS: Normal screenshot correctly rejected with category=None; submission blocked.")

# Test 9: Verify HTTP API endpoint (/api/multimodal/validate)
print("\n[TEST 9] Live HTTP Validation API Check:")
http_res_dark = post_json("/api/multimodal/validate", {"imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="})
print(f"HTTP Endpoint Response: {http_res_dark}")
assert http_res_dark['civicIssueDetected'] is False
print(">>> PASS: HTTP Validation API operational.")

# Test 6: Verify Waterlogging in UI definitions and Category configurations
print("\n[TEST 6] Application UI Category & Priority Configuration:")
with open("src/utils/userUtils.js", "r", encoding="utf-8") as f:
    user_utils_content = f.read()
assert "'Waterlogging'" in user_utils_content, "Waterlogging missing from CIVIC_CATEGORIES in userUtils.js"
assert "'Damaged concrete structures'" in user_utils_content
assert "'Potholes and RoadCracks'" in user_utils_content

with open("src/components/ui/IssueTypeTag.jsx", "r", encoding="utf-8") as f:
    issue_tag_content = f.read()
assert "'waterlogging'" in issue_tag_content, "waterlogging missing from IssueTypeTag.jsx"

with open("src/pages/Dashboard.jsx", "r", encoding="utf-8") as f:
    dashboard_content = f.read()
assert "'Waterlogging'" in dashboard_content, "Waterlogging missing from CATEGORY_CONFIG in Dashboard.jsx"

with open("src/services/gemini.js", "r", encoding="utf-8") as f:
    gemini_content = f.read()
assert "'Waterlogging'" in gemini_content, "Waterlogging missing from gemini.js"

print(">>> PASS: Waterlogging properly configured across userUtils, IssueTypeTag, Dashboard, and Gemini.")

print("\n=================================================================")
print("ALL 9 CRITICAL REQUIREMENTS VERIFIED AND PASSED!")
print("=================================================================")
