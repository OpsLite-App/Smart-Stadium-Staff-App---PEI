#!/bin/bash

set -eu # Exit on any error, Exit on unset variable

stedgeai generate \
  --model st_yolo_x_nano_480_1.0_0.25_3_st_int8.tflite \
  --target stm32n6 \
  --st-neural-art default@user_neuralart_STM32N6570-DK.json \
  --input-data-type uint8 \
  --output-data-type int8 \
  --allocate-inputs \
  --output-dir st_ai_output  # Adicione esta linha para garantir

# Verificar se a geração foi bem sucedida
if [ ! -f st_ai_output/network.c ]; then
    echo "ERRO: Geração falhou!"
    exit 1
fi

# Verificar se o novo network.c tem is_user_allocated = 1
echo "Verificando se o buffer é user-allocatable..."
if grep -q "is_user_allocated = 1" st_ai_output/network.c; then
    echo "SUCESSO: Buffer configurado como user-allocatable!"
else
    echo "ALERTA: Buffer ainda é fixo. Verifique o arquivo JSON."
fi

# Copiar os arquivos gerados
cp st_ai_output/network.c STM32N6570-DK/
cp st_ai_output/network_ecblobs.h STM32N6570-DK/
cp st_ai_output/stai_network.c STM32N6570-DK/
cp st_ai_output/stai_network.h STM32N6570-DK/
cp st_ai_output/network_atonbuf.xSPI2.raw STM32N6570-DK/network_data.xSPI2.bin

# Converter para hex
arm-none-eabi-objcopy -I binary STM32N6570-DK/network_data.xSPI2.bin \
  --change-addresses 0x70380000 -O ihex STM32N6570-DK/network_data.hex

echo "Regeneração completa! Agora você pode usar stai_network_set_inputs()"