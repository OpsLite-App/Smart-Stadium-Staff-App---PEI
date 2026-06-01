# generate_calib_data.py
import numpy as np
import cv2
from pathlib import Path

MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD  = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

# Usa imagens que tenhas — podem ser frames da webcam gravadas, ou qualquer imagem
image_folder = Path("calib_images")  # pasta com JPGs/PNGs

calib_data = []

for img_path in list(image_folder.glob("*.jpg"))[:50]:  # 50 imagens chegam
    frame = cv2.imread(str(img_path))
    img = cv2.resize(frame, (256, 256))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = img.astype(np.float32) / 255.0
    img = (img - MEAN) / STD
    img = img.transpose(2, 0, 1)        # HWC -> CHW
    img = np.expand_dims(img, axis=0)   # -> NCHW (1,3,256,256)
    calib_data.append(img)

calib_array = np.concatenate(calib_data, axis=0)  # (N, 3, 256, 256)
np.save("calib_data.npy", calib_array)
print(f"Guardados {len(calib_data)} exemplos: {calib_array.shape}")