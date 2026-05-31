/**
 * zip_postprocess.h
 * Postprocessing para o modelo ZIP de density estimation.
 *
 * O modelo ZIP produz um density map [1, 1, 16, 16] (256 floats).
 * A contagem de pessoas é a soma de todos os valores do mapa.
 *
 * Diferença face ao YOLO:
 *   YOLO  → output = bounding boxes → contar nb_detect
 *   ZIP   → output = density map   → somar todos os valores
 */

#ifndef ZIP_POSTPROCESS_H
#define ZIP_POSTPROCESS_H

#include <stdint.h>

/* Dimensões do density map de saída do modelo ZIP */
#define ZIP_OUT_H  16
#define ZIP_OUT_W  16
#define ZIP_OUT_SIZE (ZIP_OUT_H * ZIP_OUT_W)  /* 256 int8 values */

/**
 * Conta pessoas a partir do density map de saída do modelo ZIP.
 *
 * @param density_map  Ponteiro para o buffer de saída da rede (256 int8)
 * @return             Número estimado de pessoas (inteiro)
 */
uint32_t ZIP_Postprocess_GetCount(const int8_t *density_map);

#endif /* ZIP_POSTPROCESS_H */
