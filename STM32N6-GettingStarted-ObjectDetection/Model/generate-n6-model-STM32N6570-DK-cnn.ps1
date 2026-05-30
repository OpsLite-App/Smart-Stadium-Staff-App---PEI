# generate-n6-model-STM32N6570-DK-cnn.ps1

$MODEL = "my_cnn_model.onnx"

if (!(Test-Path $MODEL)) {
    Write-Host "ONNX model not found"
    exit 2
}

stedgeai generate `
  --model $MODEL `
  --target stm32n6 `
  --st-neural-art default@user_neuralart_STM32N6570-DK.json `
  --input-data-type float32 `
  --output-data-type float32

$OUT = "st_ai_output"
$DST = "STM32N6570-DK"

Copy-Item "$OUT/network.c" $DST
Copy-Item "$OUT/network_ecblobs.h" $DST
Copy-Item "$OUT/stai_network.c" $DST
Copy-Item "$OUT/stai_network.h" $DST
Copy-Item "$OUT/network_atonbuf.xSPI2.raw" "$DST/network_data.xSPI2.bin"

& arm-none-eabi-objcopy -I binary `
  "$DST/network_data.xSPI2.bin" `
  --change-addresses 0x70380000 `
  -O ihex "$DST/network_data.hex"

Write-Host "DONE"