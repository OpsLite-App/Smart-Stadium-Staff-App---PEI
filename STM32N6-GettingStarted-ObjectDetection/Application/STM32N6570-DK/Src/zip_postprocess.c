/**
 * zip_postprocess.c
 * Postprocessing para o modelo ZIP de density estimation.
 */

#include "zip_postprocess.h"

uint32_t ZIP_Postprocess_GetCount(const float *density_map)
{
    float sum = 0.0f;
    for (int i = 0; i < ZIP_OUT_SIZE; i++)
    {
        if (density_map[i] > 0.0f)
            sum += density_map[i];
    }
    return (uint32_t)(sum + 0.5f);  /* arredondar */
}
