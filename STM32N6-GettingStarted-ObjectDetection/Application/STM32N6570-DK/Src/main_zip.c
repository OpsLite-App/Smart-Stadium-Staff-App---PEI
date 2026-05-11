/**
 * main_zip.c
 * Loop principal para a board ZIP (density estimation por zona).
 *
 * Para usar este ficheiro:
 *   1. No STM32CubeIDE, excluir main.c do build (botão direito → Exclude from build)
 *   2. Incluir este ficheiro no build em substituição
 *   3. Converter zip_n_model_quant.onnx via STM32Cube.AI → substitui stai_network.c/h
 *
 * Diferenças face ao main.c (YOLO):
 *   - Não usa app_postprocess (bounding boxes) — usa ZIP_Postprocess_GetCount
 *   - Publica crowd_density em vez de gate_passage
 */

#include <string.h>
#include "cmw_camera.h"
#include "stm32n6570_discovery_bus.h"
#include "stm32n6570_discovery_lcd.h"
#include "stm32n6570_discovery_xspi.h"
#include "stm32n6570_discovery.h"
#include "stm32_lcd.h"
#include "app_fuseprogramming.h"
#include "stm32_lcd_ex.h"
#include "stai.h"
#include "stai_network.h"
#include "app_camerapipeline.h"
#include "main.h"
#include <stdio.h>
#include "app_config.h"
#include "crop_img.h"
#include "zip_postprocess.h"
#include "mqtt_publisher.h"

/* Reutiliza as funções de init do main.c original */
extern void Hardware_init(void);
extern void NeuralNetwork_init(uint32_t *nn_in_length, stai_ptr *nn_out,
                                stai_size *number_output, int32_t nn_out_len[]);

STAI_NETWORK_CONTEXT_DECLARE(network_context, STAI_NETWORK_CONTEXT_SIZE)

__attribute__ ((section (".psram_bss")))
__attribute__ ((aligned (32)))
static uint8_t lcd_bg_buffer[800 * 480 * 2];

volatile int32_t cameraFrameReceived;
stai_ptr nn_in;

#define ALIGN_TO_16(v) (((v) + 15) & ~15)
#if (STAI_NETWORK_IN_1_WIDTH * STAI_NETWORK_IN_1_CHANNEL) != \
     ALIGN_TO_16(STAI_NETWORK_IN_1_WIDTH * STAI_NETWORK_IN_1_CHANNEL)
#define DCMIPP_NN_NEEDS_CROP 1
#define DCMIPP_OUT_NN_LEN (ALIGN_TO_16(STAI_NETWORK_IN_1_WIDTH * STAI_NETWORK_IN_1_CHANNEL) \
                           * STAI_NETWORK_IN_1_HEIGHT)
#define DCMIPP_OUT_NN_BUFF_LEN (DCMIPP_OUT_NN_LEN + 32 - DCMIPP_OUT_NN_LEN % 32)
__attribute__ ((aligned (32)))
static uint8_t dcmipp_out_nn[DCMIPP_OUT_NN_BUFF_LEN];
#else
#define DCMIPP_NN_NEEDS_CROP 0
#endif

int main(void)
{
    Hardware_init();
    MQTT_Publisher_Init();

    /*** NN Init ***/
    uint32_t nn_in_len = 0;
    stai_size number_output = 0;
    stai_ptr nn_out[STAI_NETWORK_OUT_NUM] = {0};
    int32_t nn_out_len[STAI_NETWORK_OUT_NUM] = {0};
    NeuralNetwork_init(&nn_in_len, nn_out, &number_output, nn_out_len);

    /*** Camera Init ***/
    uint32_t lcd_w = 0, lcd_h = 0, pitch_nn = 0;
    CameraPipeline_Init(&lcd_w, &lcd_h, &pitch_nn);
    CameraPipeline_DisplayPipe_Start(lcd_bg_buffer, CMW_MODE_CONTINUOUS);

    printf("ZIP Density Board ready. Zone: %s\n", MQTT_ZONE_ID);

    /*** App Loop ***/
    while (1)
    {
        CameraPipeline_IspUpdate();

#if DCMIPP_NN_NEEDS_CROP
        CameraPipeline_NNPipe_Start(dcmipp_out_nn, CMW_MODE_SNAPSHOT);
#else
        CameraPipeline_NNPipe_Start(nn_in, CMW_MODE_SNAPSHOT);
#endif

        while (cameraFrameReceived == 0) {};
        cameraFrameReceived = 0;

#if DCMIPP_NN_NEEDS_CROP
        SCB_InvalidateDCache_by_Addr(dcmipp_out_nn, sizeof(dcmipp_out_nn));
        img_crop(dcmipp_out_nn, nn_in, pitch_nn,
                 STAI_NETWORK_IN_1_WIDTH, STAI_NETWORK_IN_1_HEIGHT, STAI_NETWORK_IN_1_CHANNEL);
        SCB_CleanInvalidateDCache_by_Addr(nn_in, nn_in_len);
#endif

        /* Inferência */
        int ret = stai_network_run(network_context, STAI_MODE_SYNC);
        assert(ret == 0);

        /* Postprocessing ZIP: somar density map [1,1,16,16] */
        SCB_InvalidateDCache_by_Addr(nn_out[0], nn_out_len[0]);
        uint32_t count = ZIP_Postprocess_GetCount((const float *)nn_out[0]);

        /* Publicar via MQTT */
        MQTT_Publisher_SendCount(count);

        /* Mostrar no LCD */
        UTIL_LCDEx_PrintfAt(0, LINE(2), CENTER_MODE, "Pessoas: %lu", (unsigned long)count);

        /* Invalidar cache do output */
        SCB_InvalidateDCache_by_Addr(nn_out[0], nn_out_len[0]);
    }
}
