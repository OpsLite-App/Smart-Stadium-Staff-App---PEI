"""
cnn_counter.py
Wrapper YOLOv8 para contar pessoas nos portões.
Simula o que o STM32N6 faz com o st_yolo_x_nano no hardware.
"""

import cv2
import numpy as np
import random
import os
from pathlib import Path

FALLBACK_IMAGE = Path(__file__).parent / "resources"


class CNNCounter:
    def __init__(self, model_path: str = None):
        self.model = None
        self.fallback_images = []
        self._load_model(model_path)
        self._load_fallback_images()

    def _load_model(self, model_path):
        try:
            from ultralytics import YOLO
            path = model_path or "yolov8n.pt"
            self.model = YOLO(path)
            print(f"✅ CNN (YOLO) carregado: {path}")
        except ImportError:
            print("⚠️  ultralytics não instalado: pip install ultralytics")
        except Exception as e:
            print(f"❌ Erro ao carregar CNN: {e}")

    def _load_fallback_images(self):
        if FALLBACK_IMAGE.exists():
            exts = [".jpg", ".jpeg", ".png"]
            self.fallback_images = [
                str(p) for p in FALLBACK_IMAGE.iterdir()
                if p.suffix.lower() in exts
            ]

    def count_from_frame(self, frame: np.ndarray) -> int:
        if self.model is None:
            return random.randint(0, 40)
        try:
            results = self.model(frame, classes=[0], verbose=False)  # classe 0 = person
            return len(results[0].boxes)
        except Exception as e:
            print(f"⚠️  Erro na inferência CNN: {e}")
            return random.randint(0, 40)

    def count_from_image(self, image_path: str) -> int:
        frame = cv2.imread(image_path)
        if frame is None:
            return random.randint(0, 40)
        return self.count_from_frame(frame)

    def count_from_camera(self, camera_index: int = 0) -> int:
        """Captura um frame da câmara do PC e conta pessoas."""
        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            print(f"⚠️  Câmara {camera_index} não disponível")
            return random.randint(0, 40)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return random.randint(0, 40)
        return self.count_from_frame(frame)

    def get_count(self, gate_id: str = None) -> int:
        if self.model is None:
            return random.randint(0, 40)

        # Tenta câmara do PC primeiro
        cap = cv2.VideoCapture(0)
        camera_available = cap.isOpened()
        cap.release()

        if camera_available:
            count = self.count_from_camera(0)
            print(f"   📷 CNN [{gate_id}]: {count} pessoas (câmara PC)")
            return count

        if self.fallback_images:
            image_path = random.choice(self.fallback_images)
            count = self.count_from_image(image_path)
            print(f"   📷 CNN [{gate_id}]: {count} pessoas (via {os.path.basename(image_path)})")
            return count

        return random.randint(0, 40)


_counter_instance = None

def get_counter(model_path: str = None) -> CNNCounter:
    global _counter_instance
    if _counter_instance is None:
        _counter_instance = CNNCounter(model_path)
    return _counter_instance
