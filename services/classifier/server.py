import os
import sys
import json
import base64
import io
from flask import Flask, request, jsonify
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from services.classifier.inference import get_classifier_service

app = Flask(__name__)

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@app.route("/api/health", methods=["GET"])
def health():
    import torch
    service = get_classifier_service()
    return jsonify({
        "status": "ok",
        "service": "Civic Issue Classification API",
        "cuda_available": torch.cuda.is_available(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A",
        "checkpoint_exists": os.path.exists(service.checkpoint_path),
        "num_classes": len(service.class_to_idx)
    })

@app.route("/api/classes", methods=["GET"])
def get_classes():
    service = get_classifier_service()
    classes_list = []
    for idx, cls in service.idx_to_class.items():
        classes_list.append({
            "classIndex": idx,
            "className": cls,
            "issueTypeId": service.class_to_issue_type.get(cls, "other")
        })
    return jsonify({
        "classes": classes_list,
        "count": len(classes_list)
    })

@app.route("/api/reload", methods=["POST"])
def reload_model():
    service = get_classifier_service()
    service.reload_checkpoint()
    return jsonify({
        "status": "success",
        "message": "Model reloaded successfully"
    })

@app.route("/api/classify", methods=["POST", "OPTIONS"])
def classify():
    if request.method == "OPTIONS":
        return "", 204

    service = get_classifier_service()
    image_input = None

    # 1. Check for JSON payload with imageUrl or imageBase64
    if request.is_json:
        data = request.get_json() or {}
        img_url = data.get("imageUrl") or data.get("image_url")
        img_b64 = data.get("imageBase64") or data.get("image_base64")
        if img_url:
            image_input = img_url
        elif img_b64:
            b64 = img_b64
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            image_input = base64.b64decode(b64)

    # 2. Check for uploaded file
    if image_input is None:
        file_obj = request.files.get("file") or request.files.get("image")
        if file_obj:
            image_input = file_obj.read()

    # 3. Check for form-data imageUrl
    if image_input is None and "imageUrl" in request.form:
        image_input = request.form["imageUrl"]

    if image_input is None:
        return jsonify({
            "error": "No image provided. Provide 'imageUrl', 'imageBase64', or a file upload ('file')."
        }), 400

    try:
        result = service.predict(image_input)
        return jsonify(result)
    except Exception as e:
        print(f"[API /classify Error] {e}")
        return jsonify({
            "error": str(e),
            "predictedClass": "Uncertain / Other",
            "confidence": 0.0,
            "issueTypeId": "other",
            "isUncertain": True
        }), 500

@app.route("/api/multimodal/validate", methods=["POST", "OPTIONS"])
def validate_multimodal():
    if request.method == "OPTIONS":
        return "", 204

    from services.classifier.multimodal_vision import get_multimodal_validator
    validator = get_multimodal_validator()

    image_input = None
    classifier_result = None

    if request.is_json:
        data = request.get_json() or {}
        img_url = data.get("imageUrl") or data.get("image_url")
        img_b64 = data.get("imageBase64") or data.get("image_base64")
        classifier_result = data.get("classifierResult") or data.get("classifier_result")
        if img_url:
            image_input = img_url
        elif img_b64:
            b64 = img_b64
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            image_input = base64.b64decode(b64)

    if image_input is None:
        file_obj = request.files.get("file") or request.files.get("image")
        if file_obj:
            image_input = file_obj.read()

    if image_input is None and "imageUrl" in request.form:
        image_input = request.form["imageUrl"]

    if image_input is None:
        return jsonify({
            "civicIssueDetected": False,
            "isUnclear": True,
            "category": "None",
            "confidence": 0.0,
            "reason": "No image provided for multimodal validation.",
            "message": "No image provided for multimodal validation."
        }), 400

    try:
        validation_res = validator.validate(image_input, classifier_result)
        return jsonify(validation_res)
    except Exception as e:
        print(f"[API /multimodal/validate Error] {e}")
        return jsonify({
            "civicIssueDetected": False,
            "isUnclear": True,
            "category": "None",
            "confidence": 0.0,
            "reason": f"Unable to verify image: {str(e)}",
            "message": f"Unable to verify image: {str(e)}"
        }), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting Civic Issue Classifier Server on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
