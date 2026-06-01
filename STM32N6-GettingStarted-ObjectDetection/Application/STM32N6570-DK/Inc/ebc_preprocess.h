#ifndef EBC_PREPROCESS_H
#define EBC_PREPROCESS_H

#include <stdint.h>

/* EBC normalization constants (float32) */
#define EBC_MEAN_R  0.48145466f
#define EBC_MEAN_G  0.4578275f
#define EBC_MEAN_B  0.40821073f

#define EBC_STD_R   0.26862954f
#define EBC_STD_G   0.26130258f
#define EBC_STD_B   0.27577711f

/* Cube.AI input quantization: scale=1/255, offset=-128 */
/* MAS o modelo foi treinado com MEAN/STD — usa estes:  */
#define NET_IN_SCALE   0.003921569f   /* 1/255 */
#define NET_IN_OFFSET  (-128)

void EBC_Preprocess(const uint8_t *src_rgb888,
                    int8_t        *dst_int8,
                    int            width,
                    int            height);

#endif