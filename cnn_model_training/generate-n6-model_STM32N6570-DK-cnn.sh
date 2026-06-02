#!/bin/bash

set -eu # Exit on any error, Exit on unset variable

MODEL_ONNX="cnn_model.onnx"

if [ ! -f "$MODEL_ONNX" ]; then
  echo "ONNX model '$MODEL_ONNX' not found in Model/; please add it first."
  exit 2
fi

stedgeai generate --model "$MODEL_ONNX" --target stm32n6 --st-neural-art default@user_neuralart_STM32N6570-DK.json --input-data-type float32 --output-data-type float32

cp st_ai_output/network.c STM32N6570-DK/
cp st_ai_output/network_ecblobs.h STM32N6570-DK/
cp st_ai_output/stai_network.c STM32N6570-DK/
cp st_ai_output/stai_network.h STM32N6570-DK/
cp st_ai_output/network_atonbuf.xSPI2.raw STM32N6570-DK/network_data.xSPI2.bin
arm-none-eabi-objcopy -I binary STM32N6570-DK/network_data.xSPI2.bin --change-addresses 0x70380000 -O ihex STM32N6570-DK/network_data.hex

echo "Generation complete. Files copied to STM32N6570-DK/"
