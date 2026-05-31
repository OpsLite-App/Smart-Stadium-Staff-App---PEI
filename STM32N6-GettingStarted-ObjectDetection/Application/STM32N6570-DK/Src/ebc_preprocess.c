#include "ebc_preprocess.h"
#include <stdint.h>

/* Pré-calcula os factores de quantização por canal
 *
 * Pipeline:
 *   float_val = (uint8 / 255.0 - MEAN) / STD
 *   int8_val  = clamp(round(float_val / NET_IN_SCALE) + NET_IN_OFFSET, -128, 127)
 *
 * Simplificado:
 *   int8_val = clamp(round(uint8 * A + B), -128, 127)
 *
 * Onde:
 *   A = 1.0 / (255.0 * STD * NET_IN_SCALE)  -- mas NET_IN_SCALE=1/255 cancela
 *   A = 1.0 / STD
 *   B = (-MEAN / STD) / NET_IN_SCALE + NET_IN_OFFSET
 *     = (-MEAN / STD) * 255 + NET_IN_OFFSET
 */

/* Factores pré-calculados por canal (A, B) */
/* R: A = 1/STD_R, B = (-MEAN_R/STD_R)*255 + (-128) */
#define FACTOR_A_R  (1.0f / EBC_STD_R)
#define FACTOR_B_R  ((-EBC_MEAN_R / EBC_STD_R) * 255.0f + NET_IN_OFFSET)

#define FACTOR_A_G  (1.0f / EBC_STD_G)
#define FACTOR_B_G  ((-EBC_MEAN_G / EBC_STD_G) * 255.0f + NET_IN_OFFSET)

#define FACTOR_A_B  (1.0f / EBC_STD_B)
#define FACTOR_B_B  ((-EBC_MEAN_B / EBC_STD_B) * 255.0f + NET_IN_OFFSET)

static inline int8_t clamp_int8(float v)
{
    if (v >  127.0f) return  127;
    if (v < -128.0f) return -128;
    return (int8_t)(v + (v >= 0.0f ? 0.5f : -0.5f));  /* round */
}

void EBC_Preprocess(const uint8_t *src_rgb888,
                    int8_t        *dst_int8,
                    int            width,
                    int            height)
{
    int npix = width * height;

    /* Output em CHW: [R_plane | G_plane | B_plane] */
    int8_t *dst_r = dst_int8;
    int8_t *dst_g = dst_int8 + npix;
    int8_t *dst_b = dst_int8 + npix * 2;

    for (int i = 0; i < npix; i++)
    {
        uint8_t r = src_rgb888[i * 3 + 0];
        uint8_t g = src_rgb888[i * 3 + 1];
        uint8_t b = src_rgb888[i * 3 + 2];

        dst_r[i] = clamp_int8((float)r * FACTOR_A_R + FACTOR_B_R);
        dst_g[i] = clamp_int8((float)g * FACTOR_A_G + FACTOR_B_G);
        dst_b[i] = clamp_int8((float)b * FACTOR_A_B + FACTOR_B_B);
    }
}