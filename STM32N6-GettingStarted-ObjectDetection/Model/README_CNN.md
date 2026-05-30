This folder contains helper scripts and notes for generating STM32N6 runtime files from models.

CNN/ONNX workflow (STM32N6570-DK)

- Place your CNN model in ONNX format into this folder and name it `my_cnn_model.onnx` (or update the script variable).
- If you have a TensorFlow/TFLite model and need ONNX, convert using `tf2onnx` or `onnx-tf`. Example (from a TensorFlow SavedModel):

```bash
# install conversion tool
pip install tf2onnx

# convert SavedModel to ONNX
python -m tf2onnx.convert --saved-model saved_model_dir --output my_cnn_model.onnx --opset 13

# or convert from a TFLite model using tflite2onnx (third-party tool) or re-export from TF
```

- After placing `my_cnn_model.onnx` here, run the generation script:

```bash
cd STM32N6-GettingStarted-ObjectDetection/Model
./generate-n6-model_STM32N6570-DK-cnn.sh
```

- The script calls `stedgeai generate` to produce MCU-ready C files and copies them to `STM32N6570-DK/`.

Notes
- The `stedgeai` tool must support ONNX input for this to work; the existing project already uses `stedgeai generate` for TFLite, and it typically accepts ONNX as an input format.
- The script assumes model input/output dtypes are `float32`. Adjust `--input-data-type` and `--output-data-type` in the script if your model is quantized (e.g., uint8/int8).
- This approach only changes files inside `Model/` and copies runtime artifacts into the existing `STM32N6570-DK/` folder, reusing the rest of the project unchanged.
