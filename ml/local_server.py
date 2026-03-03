import atexit
import base64
import os
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.environ.get("CRASH_MODEL_PATH", BASE_DIR / "best_float32.tflite")).expanduser()
CAMERA_INDEX = int(os.environ.get("CRASH_CAMERA_INDEX", "0"))
CONFIDENCE = float(os.environ.get("CRASH_MIN_CONF", "0.25"))

app = Flask(__name__)
CORS(app)

inference_error = None
capture_lock = Lock()
cap = None

try:
    model = YOLO(str(MODEL_PATH), task="detect")
except Exception as exc:
    raise RuntimeError(f"Failed to load model '{MODEL_PATH}': {exc}") from exc

try:
    _dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    _ = model(_dummy, conf=CONFIDENCE, verbose=False)
except Exception as exc:
    inference_error = str(exc)


def _get_capture():
    global cap
    if cap is not None and cap.isOpened():
        return cap
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    if not cap.isOpened():
        cap = None
    return cap


def _decode_data_url_to_frame(image_data):
    if not image_data or not isinstance(image_data, str):
        return None
    if "," in image_data:
        _, image_data = image_data.split(",", 1)
    try:
        raw = base64.b64decode(image_data)
        arr = np.frombuffer(raw, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None


def _severity_from_confidence(score):
    if score >= 0.8:
        return "HIGH"
    if score >= 0.55:
        return "MEDIUM"
    return "LOW"


def _build_summaries(severity):
    if severity == "HIGH":
        return (
            "High likelihood crash detected from vision model. Immediate dispatch recommended.",
            "Possible severe crash detected. Emergency services should be contacted now.",
        )
    if severity == "MEDIUM":
        return (
            "Moderate crash likelihood detected. Dispatch and driver check recommended.",
            "Possible crash detected. Please check the driver's status immediately.",
        )
    return (
        "Low crash confidence from vision model. Continue monitoring.",
        "Possible minor incident detected. Please check in with the driver.",
    )


def _analyze_frame(frame):
    result = model(frame, conf=CONFIDENCE, verbose=False)[0]
    boxes = result.boxes
    detections = []
    max_conf = 0.0

    names = getattr(result, "names", {}) or {}
    for box in boxes:
        conf = float(box.conf[0]) if box.conf is not None else 0.0
        cls_idx = int(box.cls[0]) if box.cls is not None else -1
        label = names.get(cls_idx, str(cls_idx)) if isinstance(names, dict) else str(cls_idx)
        xyxy = box.xyxy[0].tolist() if box.xyxy is not None else []
        detections.append(
            {
                "label": label,
                "confidence": round(conf, 4),
                "bbox": [round(v, 2) for v in xyxy],
            }
        )
        max_conf = max(max_conf, conf)

    severity = _severity_from_confidence(max_conf)
    dispatcher_summary, loved_ones_message = _build_summaries(severity)

    return {
        "provider": "local_model",
        "model": MODEL_PATH.name,
        "crashDetected": len(detections) > 0,
        "severityLevel": severity,
        "confidenceScore": round(max_conf, 4),
        "detectionCount": len(detections),
        "detections": detections,
        "enriched": {
            "dispatcherSummary": dispatcher_summary,
            "lovedOnesMessage": loved_ones_message,
        },
    }, result


def generate_frames():
    if inference_error:
        return

    camera = _get_capture()
    if camera is None:
        return

    while True:
        with capture_lock:
            success, frame = camera.read()
        if not success:
            continue

        payload, result = _analyze_frame(frame)
        annotated = result.plot()

        if payload["severityLevel"] == "HIGH":
            cv2.putText(
                annotated,
                "ALARM: SEVERE CRASH DETECTED!",
                (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 0, 255),
                3,
            )

        ok, buffer = cv2.imencode(".jpg", annotated)
        if not ok:
            continue

        frame_bytes = buffer.tobytes()
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"


@app.get("/health")
def health():
    return jsonify(
        {
            "ok": inference_error is None,
            "model": MODEL_PATH.name,
            "inference_error": inference_error,
        }
    )


@app.post("/analyze")
def analyze():
    if inference_error:
        return jsonify({"error": "Model runtime unavailable", "details": inference_error}), 503

    body = request.get_json(silent=True) or {}
    frame = _decode_data_url_to_frame(body.get("imageData"))

    if frame is None:
        camera = _get_capture()
        if camera is None:
            return jsonify({"error": "No camera frame and imageData missing"}), 503
        with capture_lock:
            success, frame = camera.read()
        if not success:
            return jsonify({"error": "Failed to read frame from webcam"}), 503

    payload, _ = _analyze_frame(frame)
    return jsonify(payload)


@app.get("/video")
def video():
    if inference_error:
        return (
            "Model runtime is not available for TFLite inference.\n"
            f"Details: {inference_error}\n",
            503,
            {"Content-Type": "text/plain; charset=utf-8"},
        )

    if _get_capture() is None:
        return (
            "Camera is not available for /video stream.\n"
            "Use POST /analyze with imageData for browser-camera analysis.\n",
            503,
            {"Content-Type": "text/plain; charset=utf-8"},
        )

    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


def cleanup():
    global cap
    if cap is not None and cap.isOpened():
        cap.release()
    cap = None


atexit.register(cleanup)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
