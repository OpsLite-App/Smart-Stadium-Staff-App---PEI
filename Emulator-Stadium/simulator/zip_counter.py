"""
zip_counter.py
Wrapper simples para o modelo ZIP ONNX.
Usado pelo simulador para obter contagens de pessoas por zona.
"""

import cv2
import numpy as np
import onnxruntime as ort
import os
import random
from pathlib import Path

# Normalização EBC (igual ao main.py dos coordenadores)
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD  = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

# Imagem de fallback (usada quando não há câmara real)
FALLBACK_IMAGE = Path(__file__).parent / "resources"


class ZIPCounter:
    def __init__(self, model_path: str = "model/zip_n_model_quant.onnx"):
        """
        Carrega o modelo ZIP ONNX.
        
        Args:
            model_path: Caminho para o ficheiro .onnx
        """
        self.model_path = model_path
        self.session = None
        self.input_name = None
        self.input_w = 256
        self.input_h = 256

        # Imagens de fallback disponíveis (para simular sem câmara)
        self.fallback_images = []

        self._load_model()
        self._load_fallback_images()

    def _load_model(self):
        """Carrega o modelo ONNX."""
        if not os.path.exists(self.model_path):
            print(f"❌ Modelo não encontrado: {self.model_path}")
            return

        try:
            self.session = ort.InferenceSession(self.model_path)
            self.input_name = self.session.get_inputs()[0].name
            shape = self.session.get_inputs()[0].shape

            if len(shape) == 4 and all(isinstance(d, int) for d in shape[2:]):
                self.input_h, self.input_w = shape[2], shape[3]

            print(f"✅ Modelo ZIP carregado: {self.model_path}")
            print(f"   Input: {self.input_w}x{self.input_h}")
        except Exception as e:
            print(f"❌ Erro ao carregar modelo: {e}")

    def _load_fallback_images(self):
        """Carrega imagens da pasta resources/ para usar como fallback."""
        if FALLBACK_IMAGE.exists():
            exts = [".jpg", ".jpeg", ".png"]
            self.fallback_images = [
                str(p) for p in FALLBACK_IMAGE.iterdir()
                if p.suffix.lower() in exts
            ]
        if self.fallback_images:
            print(f"   Imagens de fallback: {len(self.fallback_images)} encontradas")
        else:
            print("   ⚠️  Sem imagens de fallback — modo aleatório ativo")

    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        """Pré-processa frame para o modelo."""
        img = cv2.resize(frame, (self.input_w, self.input_h))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.astype(np.float32) / 255.0
        img = (img - MEAN) / STD
        img = img.transpose(2, 0, 1)[np.newaxis]  # CHW + batch
        return img

    def count_from_frame(self, frame: np.ndarray) -> int:
        """
        Conta pessoas num frame (numpy array BGR).
        
        Args:
            frame: Imagem em formato BGR (OpenCV)
        Returns:
            Número estimado de pessoas
        """
        if self.session is None:
            return random.randint(10, 200)

        try:
            blob = self._preprocess(frame)
            outputs = self.session.run(None, {self.input_name: blob})
            density_map = outputs[0][0][0]
            return max(0, int(round(float(np.sum(density_map)))))
        except Exception as e:
            print(f"⚠️  Erro na inferência: {e}")
            return random.randint(10, 200)

    def count_from_image(self, image_path: str) -> int:
        """
        Conta pessoas numa imagem em disco.
        
        Args:
            image_path: Caminho para a imagem
        Returns:
            Número estimado de pessoas
        """
        frame = cv2.imread(image_path)
        if frame is None:
            print(f"⚠️  Não consegui ler imagem: {image_path}")
            return random.randint(10, 200)
        return self.count_from_frame(frame)

    def get_count(self, area_node_id: str = None) -> int:
        """
        Retorna contagem de pessoas para uma zona do estádio.
        
        Usa imagem real se disponível, senão usa fallback da pasta resources/.
        Se não houver nenhuma imagem, gera número aleatório.
        
        Args:
            area_node_id: ID da zona (para futura associação câmara↔zona)
        Returns:
            Número estimado de pessoas
        """
        # Aqui podes no futuro mapear area_node_id → câmara específica
        # Ex: camera_map = {"gate_A": "rtsp://...", "zone_1": "rtsp://..."}

        if self.session is None:
            # Modelo não carregado — fallback aleatório
            return random.randint(10, 200)

        if self.fallback_images:
            # Usa imagem aleatória da pasta resources/
            image_path = random.choice(self.fallback_images)
            count = self.count_from_image(image_path)
            print(f"   📷 ZIP [{area_node_id}]: {count} pessoas (via {os.path.basename(image_path)})")
            return count
        else:
            # Sem imagens — aleatório
            return random.randint(10, 200)


# Instância global (singleton) para reutilizar o modelo carregado
_counter_instance = None

def get_counter(model_path: str = "model/zip_n_model_quant.onnx") -> ZIPCounter:
    """Retorna instância singleton do ZIPCounter."""
    global _counter_instance
    if _counter_instance is None:
        _counter_instance = ZIPCounter(model_path)
    return _counter_instance