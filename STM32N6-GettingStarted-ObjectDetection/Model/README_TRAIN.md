This document explains how to prepare a person-only dataset from the COCO archives and train a tiny/nano YOLO model, export to ONNX, and generate STM32 runtime artifacts.

1) Prepare dataset
- Ensure you have extracted the COCO archives into the repository `COCO/` folder so the following paths exist:
  - COCO/train2017/
  - COCO/val2017/
  - COCO/annotations/instances_train2017.json
  - COCO/annotations/instances_val2017.json

- Run the converter (from the Model/ folder):
  python convert_coco_person_to_yolo.py --coco_root ../../COCO --out_dir person_dataset

This will create person_dataset/images/train, person_dataset/images/val and matching labels/ folders containing only images that include COCO person annotations.

2) Install requirements (prefer a virtualenv or Colab GPU):
  pip install -r requirements_train.txt

3) Train a tiny/nano model (Ultralytics YOLOv8 example):
  yolo detect train model=yolov8n.pt data=data_person.yaml epochs=50 imgsz=320 batch=16

4) Export to ONNX
  yolo export model=runs/detect/train/weights/best.pt format=onnx imgsz=320

5) Generate STM32 artifacts
- Move or copy the produced ONNX file into Model/ and rename it to my_cnn_model.onnx (or update the script variable).
- Run the generator script (requires stedgeai and arm-none-eabi-objcopy in PATH):
  ./generate-n6-model_STM32N6570-DK-cnn.sh

Notes
- If you require quantization to int8 for MCU performance/size, perform post-training quantization during export or use tools that support ONNX quantization (e.g., onnxruntime quantization tools) before running stedgeai generate, and set --input-data-type/--output-data-type in the generator script accordingly.
- Training on full COCO is large; use Colab / GPU instance. The convert_coco_person_to_yolo.py script filters only images with person annotations to reduce dataset size.
