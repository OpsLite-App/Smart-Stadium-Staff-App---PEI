#include "zip_postprocess.h"

/* ✅ NOVO: output 28x28 = 784 elementos! */
#define OUTPUT_SCALE      0.005676019f
#define OUTPUT_ZERO_POINT (-128)
#define ZIP_OUT_SIZE      784  // 28*28

uint32_t ZIP_Postprocess_GetCount(const int8_t *density_map)
{
    float sum = 0.0f;
    for (int i = 0; i < ZIP_OUT_SIZE; i++) {
        float val = (density_map[i] - OUTPUT_ZERO_POINT) * OUTPUT_SCALE;
        if (val > 0.0f) sum += val;
    }
    return (uint32_t)(sum + 0.5f);
}