#include "ll_aton_NN_interface.h"
#include "ll_aton.h"
#include "ll_aton_ec_trace.h"

#if 0
// Workaround: the tracer does not know the target at this moment
// and cannot call the functions since are used in static code
#define ATON_LIB_PHYSICAL_TO_VIRTUAL_ADDR(address) LL_Address_Physical2Virtual(address)
#define ATON_LIB_VIRTUAL_TO_PHYSICAL_ADDR(address) LL_Address_Virtual2Physical(address)
#else
#define ATON_LIB_PHYSICAL_TO_VIRTUAL_ADDR(address) (address)
#define ATON_LIB_VIRTUAL_TO_PHYSICAL_ADDR(address) (address)
#endif


// MCU cache line size: 32 (bytes)
// NPU cache line size: 64 (bytes)
// MCU+NPU cache line size equal to 64 bytes (power of 2 not less than 8)
unsigned int cache_line_size = 64;

mpool_reloc_info_t mpool_reloc_info[] = {
  {"AXISRAM6", "_mem_pool_AXISRAM6_network", 0x34350000, 1, 0},
  {"AXISRAM5", "_mem_pool_AXISRAM5_network", 0x342e0000, 1, 0},
  {"AXISRAM4", "_mem_pool_AXISRAM4_network", 0x34270000, 1, 0},
  {"AXISRAM3", "_mem_pool_AXISRAM3_network", 0x34200000, 1, 0},
  {"AXISRAM2", "_mem_pool_AXISRAM2_network", 0x34100000, 1, 0},
  {"AXISRAM1", "_mem_pool_AXISRAM1_network", 0x34080000, 1, 0},
  {"AXIFLEXMEM", "_mem_pool_AXIFLEXMEM_network", 0x34000000, 1, 0},
  {"xSPI1", "_mem_pool_xSPI1_network", 0x90000000, 1, 0},
  {"xSPI2", "_mem_pool_xSPI2_network", 0x70380000, 1, 0},
  {"AXISRAM2_AXISRAM3_AXISRAM4_AXISRAM5_AXISRAM6", "_mem_pool_AXISRAM2_AXISRAM3_AXISRAM4_AXISRAM5_AXISRAM6_network", 0x34100000, 1, 0},
  {NULL, NULL, 0, 0, 0}
};


void trace_ec__ec_blob_network_1(void) {
  ec_trace_start_blob("_ec_blob_network_1");
  ec_trace_start_epoch(1);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Identity node=Identity_inserted_id804 */
    /* node=Identity_inserted_id804 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 8 [STREAM_ENG_V2 8] */
    /* Emit conf for STREAM_ENG_V2 node=Identity_inserted_id804 input ports=0 range=11[0,602112] */

    static const LL_Streng_TensorInitTypeDef Identity_inserted_id804_dma_init_in_0_1 = {
      /* from memory with batch=1 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34100000UL) /* Equivalent hex address = 0x34100000UL */}, /* Input_2_out_0_inserted_in804 */
      .offset_start = 0,
      .offset_end = 200704,
      .offset_limit = 602176,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 200704,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(8, &Identity_inserted_id804_dma_init_in_0_1, 1);


    /* Dma input bandwidth from memory pools: */
    /* cpuRAM2 -> 602112 */

    /* Dma output units from cycle: */
    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Identity_inserted_id804 output ports=0 range=11[602112,1204224] */

    static const LL_Streng_TensorInitTypeDef Identity_inserted_id804_dma_init_out_0_1 = {
      /* to memory canonical from batch=1 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34100000UL) /* Equivalent hex address = 0x34100000UL */}, /* Input_2_out_0_inserted_out804 */
      .offset_start = 602112,
      .offset_limit = 1204288,
      .frame_count = 0,
      .fwidth = 224,
      .fheight = 224,
      .batch_depth = 2,
      .batch_offset = 12,
      .frame_offset = 4,
      .line_offset = 0,
      .loop_offset = 602112,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Identity_inserted_id804_dma_init_out_0_1, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM3 <- 155648 */
    /* cpuRAM2 <- 446464 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_1[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Identity_inserted_id804 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 8 out port=0 */
    };


    /* epoch=1 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_1, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_1_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_1_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x8);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_1[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Identity_inserted_id804 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 8 out port=0 */
    };


    /* epoch=1 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_1, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_1_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_1_all_units, 2);

  }
  ec_trace_end_epoch(1);
  ec_trace_end_blob("_ec_blob_network_1");
}

void trace_ec__ec_blob_network_19(void) {
  ec_trace_start_blob("_ec_blob_network_19");
  ec_trace_start_epoch(19);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_20 */
    /* node=Concat_20 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_20 input ports=0 range=11[0,602112] */

    static const LL_Streng_TensorInitTypeDef Concat_20_dma_init_in_0_19 = {
      /* from memory with batch=16 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34100000UL) /* Equivalent hex address = 0x34100000UL */}, /* Split_12_out_0 */
      .offset_start = 0,
      .offset_end = 200704,
      .offset_limit = 602176,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 200704,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Concat_20_dma_init_in_0_19, 1);


    /* Dma input bandwidth from memory pools: */
    /* cpuRAM2 -> 602112 */

    /* Dma output units from cycle: */
    /* Unit= 7 [STREAM_ENG_V2 7] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_20 output ports=0 range=11[1449984,2052096] */

    static const LL_Streng_TensorInitTypeDef Concat_20_dma_init_out_0_19 = {
      /* to memory canonical from batch=16 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34100000UL) /* Equivalent hex address = 0x34100000UL */}, /* Concat_20_out_0 */
      .offset_start = 1449984,
      .offset_limit = 2052160,
      .frame_count = 0,
      .fwidth = 56,
      .fheight = 56,
      .batch_depth = 32,
      .batch_offset = 192,
      .frame_offset = 64,
      .line_offset = 0,
      .loop_offset = 602112,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(7, &Concat_20_dma_init_out_0_19, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 86016 */
    /* npuRAM4 <- 458752 */
    /* npuRAM3 <- 57344 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_19[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_20 OUT: in unit=STREAM_ENG_V2 7 in port=0 out unit=STREAM_ENG_V2 3 out port=0 */
    };


    /* epoch=19 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_19, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_19_all_units[] = {
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_19_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x80);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_19[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_20 OUT: in unit=STREAM_ENG_V2 7 in port=0 out unit=STREAM_ENG_V2 3 out port=0 */
    };


    /* epoch=19 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_19, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_19_all_units[] = {
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_19_all_units, 2);

  }
  ec_trace_end_epoch(19);
  ec_trace_end_blob("_ec_blob_network_19");
}

void trace_ec__ec_blob_network_44(void) {
  ec_trace_start_blob("_ec_blob_network_44");
  ec_trace_start_epoch(44);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_45 */
    /* node=Concat_45 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 0 [STREAM_ENG_V2 0] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_45 input ports=0 range=1[0,401408] */

    static const LL_Streng_TensorInitTypeDef Concat_45_dma_init_in_0_44 = {
      /* from memory with batch=32 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Split_30_out_0 */
      .offset_start = 0,
      .offset_end = 100352,
      .offset_limit = 401472,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 100352,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(0, &Concat_45_dma_init_in_0_44, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 401408 */

    /* Dma output units from cycle: */
    /* Unit= 8 [STREAM_ENG_V2 8] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_45 output ports=0 range=2[0,401408] */

    static const LL_Streng_TensorInitTypeDef Concat_45_dma_init_out_0_44 = {
      /* to memory canonical from batch=32 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34270000UL) /* Equivalent hex address = 0x34270000UL */}, /* Concat_45_out_0 */
      .offset_start = 0,
      .offset_limit = 401472,
      .frame_count = 0,
      .fwidth = 28,
      .fheight = 28,
      .batch_depth = 64,
      .batch_offset = 512,
      .frame_offset = 128,
      .line_offset = 0,
      .loop_offset = 401408,
      .frame_loop_cnt = 4,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(8, &Concat_45_dma_init_out_0_44, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM4 <- 401408 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_44[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 0, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_45 OUT: in unit=STREAM_ENG_V2 8 in port=0 out unit=STREAM_ENG_V2 0 out port=0 */
    };


    /* epoch=44 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_44, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_44_all_units[] = {
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
      { {STRENG, 0} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_44_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x100);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_44[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 0, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_45 OUT: in unit=STREAM_ENG_V2 8 in port=0 out unit=STREAM_ENG_V2 0 out port=0 */
    };


    /* epoch=44 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_44, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_44_all_units[] = {
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
      { {STRENG, 0} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_44_all_units, 2);

  }
  ec_trace_end_epoch(44);
  ec_trace_end_blob("_ec_blob_network_44");
}

void trace_ec__ec_blob_network_69(void) {
  ec_trace_start_blob("_ec_blob_network_69");
  ec_trace_start_epoch(69);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_70 */
    /* node=Concat_70 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 4 [STREAM_ENG_V2 4] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_70 input ports=0 range=1[200704,401408] */

    static const LL_Streng_TensorInitTypeDef Concat_70_dma_init_in_0_69 = {
      /* from memory with batch=64 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Split_55_out_0 */
      .offset_start = 200704,
      .offset_end = 250880,
      .offset_limit = 401472,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 50176,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(4, &Concat_70_dma_init_in_0_69, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 200704 */

    /* Dma output units from cycle: */
    /* Unit= 9 [STREAM_ENG_V2 9] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_70 output ports=0 range=1[0,200704] */

    static const LL_Streng_TensorInitTypeDef Concat_70_dma_init_out_0_69 = {
      /* to memory canonical from batch=64 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Concat_70_out_0 */
      .offset_start = 0,
      .offset_limit = 200768,
      .frame_count = 0,
      .fwidth = 14,
      .fheight = 14,
      .batch_depth = 128,
      .batch_offset = 1024,
      .frame_offset = 256,
      .line_offset = 0,
      .loop_offset = 200704,
      .frame_loop_cnt = 4,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(9, &Concat_70_dma_init_out_0_69, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 200704 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_69[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_70 OUT: in unit=STREAM_ENG_V2 9 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=69 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_69, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_69_all_units[] = {
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_69_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x200);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_69[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_70 OUT: in unit=STREAM_ENG_V2 9 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=69 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_69, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_69_all_units[] = {
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_69_all_units, 2);

  }
  ec_trace_end_epoch(69);
  ec_trace_end_blob("_ec_blob_network_69");
}

void trace_ec__ec_blob_network_87(void) {
  ec_trace_start_blob("_ec_blob_network_87");
  ec_trace_start_epoch(87);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_88 */
    /* node=Concat_88 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 9 [STREAM_ENG_V2 9] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_88 input ports=0 range=1[75264,150528] */

    static const LL_Streng_TensorInitTypeDef Concat_88_dma_init_in_0_87 = {
      /* from memory with batch=128 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Split_80_out_0 */
      .offset_start = 75264,
      .offset_end = 100352,
      .offset_limit = 150592,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 25088,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(9, &Concat_88_dma_init_in_0_87, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 75264 */

    /* Dma output units from cycle: */
    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_88 output ports=0 range=1[0,75264] */

    static const LL_Streng_TensorInitTypeDef Concat_88_dma_init_out_0_87 = {
      /* to memory canonical from batch=128 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Concat_88_out_0 */
      .offset_start = 0,
      .offset_limit = 75328,
      .frame_count = 0,
      .fwidth = 7,
      .fheight = 7,
      .batch_depth = 256,
      .batch_offset = 1536,
      .frame_offset = 512,
      .line_offset = 0,
      .loop_offset = 75264,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Concat_88_dma_init_out_0_87, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 75264 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_87[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_88 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 9 out port=0 */
    };


    /* epoch=87 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_87, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_87_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_87_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x8);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_87[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_88 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 9 out port=0 */
    };


    /* epoch=87 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_87, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_87_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_87_all_units, 2);

  }
  ec_trace_end_epoch(87);
  ec_trace_end_blob("_ec_blob_network_87");
}

void trace_ec__ec_blob_network_101(void) {
  ec_trace_start_blob("_ec_blob_network_101");
  ec_trace_start_epoch(101);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_96 */
    /* node=Concat_96 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 7 [STREAM_ENG_V2 7] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_96 input ports=0 range=1[100352,200704] */

    static const LL_Streng_TensorInitTypeDef Concat_96_dma_init_in_0_101 = {
      /* from memory with batch=128 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Conv2D_92_out_0 */
      .offset_start = 100352,
      .offset_end = 125440,
      .offset_limit = 200768,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 25088,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(7, &Concat_96_dma_init_in_0_101, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 100352 */

    /* Dma output units from cycle: */
    /* Unit= 2 [STREAM_ENG_V2 2] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_96 output ports=0 range=1[0,100352] */

    static const LL_Streng_TensorInitTypeDef Concat_96_dma_init_out_0_101 = {
      /* to memory canonical from batch=128 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Concat_96_out_0 */
      .offset_start = 0,
      .offset_limit = 100416,
      .frame_count = 0,
      .fwidth = 7,
      .fheight = 7,
      .batch_depth = 256,
      .batch_offset = 2048,
      .frame_offset = 512,
      .line_offset = 0,
      .loop_offset = 100352,
      .frame_loop_cnt = 4,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(2, &Concat_96_dma_init_out_0_101, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 100352 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_101[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 2, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_96 OUT: in unit=STREAM_ENG_V2 2 in port=0 out unit=STREAM_ENG_V2 7 out port=0 */
    };


    /* epoch=101 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_101, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_101_all_units[] = {
      { {STRENG, 2} }, /* STREAM_ENG_V2 */
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_101_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x4);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_101[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 2, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_96 OUT: in unit=STREAM_ENG_V2 2 in port=0 out unit=STREAM_ENG_V2 7 out port=0 */
    };


    /* epoch=101 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_101, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_101_all_units[] = {
      { {STRENG, 2} }, /* STREAM_ENG_V2 */
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_101_all_units, 2);

  }
  ec_trace_end_epoch(101);
  ec_trace_end_blob("_ec_blob_network_101");
}

void trace_ec__ec_blob_network_105(void) {
  ec_trace_start_blob("_ec_blob_network_105");
  ec_trace_start_epoch(105);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Resize_100_resize_NN_expansion_concat_9 */
    /* node=Resize_100_resize_NN_expansion_concat_9 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Resize_100_resize_NN_expansion_concat_9 input ports=0 range=3[401408,451584] */

    static const LL_Streng_TensorInitTypeDef Resize_100_resize_NN_expansion_concat_9_dma_init_in_0_105 = {
      /* from memory with batch=256
iterating outer iter=0 num_higher_elem=4
spanning across 200704 bytes */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34200000UL) /* Equivalent hex address = 0x34200000UL */}, /* Mul_99_out_0 */
      .offset_start = 401408,
      .offset_end = 451584,
      .offset_limit = 451648,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 50176,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 1,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Resize_100_resize_NN_expansion_concat_9_dma_init_in_0_105, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM3 -> 200704 */

    /* Dma output units from cycle: */
    /* Unit= 9 [STREAM_ENG_V2 9] */
    /* Emit conf for STREAM_ENG_V2 node=Resize_100_resize_NN_expansion_concat_9 output ports=0 range=1[0,200704] */

    static const LL_Streng_TensorInitTypeDef Resize_100_resize_NN_expansion_concat_9_dma_init_out_0_105 = {
      /* to memory canonical from batch=256 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Resize_100_resize_NN_expansion_concat_9_out_10 */
      .offset_start = 0,
      .offset_limit = 200768,
      .frame_count = 0,
      .fwidth = 7,
      .fheight = 7,
      .batch_depth = 512,
      .batch_offset = 4096,
      .frame_offset = 1024,
      .line_offset = 0,
      .loop_offset = 200704,
      .frame_loop_cnt = 4,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(9, &Resize_100_resize_NN_expansion_concat_9_dma_init_out_0_105, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 200704 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_105[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Resize_100_resize_NN_expansion_concat_9 OUT: in unit=STREAM_ENG_V2 9 in port=0 out unit=STREAM_ENG_V2 3 out port=0 */
    };


    /* epoch=105 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_105, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_105_all_units[] = {
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_105_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x200);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_105[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Resize_100_resize_NN_expansion_concat_9 OUT: in unit=STREAM_ENG_V2 9 in port=0 out unit=STREAM_ENG_V2 3 out port=0 */
    };


    /* epoch=105 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_105, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_105_all_units[] = {
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_105_all_units, 2);

  }
  ec_trace_end_epoch(105);
  ec_trace_end_blob("_ec_blob_network_105");
}

void trace_ec__ec_blob_network_118(void) {
  ec_trace_start_blob("_ec_blob_network_118");
  ec_trace_start_epoch(118);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_112 */
    /* node=Concat_112 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 0 [STREAM_ENG_V2 0] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_112 input ports=0 range=1[150528,301056] */

    static const LL_Streng_TensorInitTypeDef Concat_112_dma_init_in_0_118 = {
      /* from memory with batch=64 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Split_105_out_0 */
      .offset_start = 150528,
      .offset_end = 200704,
      .offset_limit = 301120,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 50176,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(0, &Concat_112_dma_init_in_0_118, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 150528 */

    /* Dma output units from cycle: */
    /* Unit= 6 [STREAM_ENG_V2 6] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_112 output ports=0 range=1[0,150528] */

    static const LL_Streng_TensorInitTypeDef Concat_112_dma_init_out_0_118 = {
      /* to memory canonical from batch=64 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Concat_112_out_0 */
      .offset_start = 0,
      .offset_limit = 150592,
      .frame_count = 0,
      .fwidth = 14,
      .fheight = 14,
      .batch_depth = 128,
      .batch_offset = 768,
      .frame_offset = 256,
      .line_offset = 0,
      .loop_offset = 150528,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(6, &Concat_112_dma_init_out_0_118, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 150528 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_118[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 6, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 0, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_112 OUT: in unit=STREAM_ENG_V2 6 in port=0 out unit=STREAM_ENG_V2 0 out port=0 */
    };


    /* epoch=118 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_118, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_118_all_units[] = {
      { {STRENG, 6} }, /* STREAM_ENG_V2 */
      { {STRENG, 0} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_118_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x40);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_118[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 6, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 0, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_112 OUT: in unit=STREAM_ENG_V2 6 in port=0 out unit=STREAM_ENG_V2 0 out port=0 */
    };


    /* epoch=118 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_118, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_118_all_units[] = {
      { {STRENG, 6} }, /* STREAM_ENG_V2 */
      { {STRENG, 0} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_118_all_units, 2);

  }
  ec_trace_end_epoch(118);
  ec_trace_end_blob("_ec_blob_network_118");
}

void trace_ec__ec_blob_network_122(void) {
  ec_trace_start_blob("_ec_blob_network_122");
  ec_trace_start_epoch(122);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Resize_116_resize_NN_expansion_concat_13 */
    /* node=Resize_116_resize_NN_expansion_concat_13 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 9 [STREAM_ENG_V2 9] */
    /* Emit conf for STREAM_ENG_V2 node=Resize_116_resize_NN_expansion_concat_13 input ports=0 range=3[200704,301056] */

    static const LL_Streng_TensorInitTypeDef Resize_116_resize_NN_expansion_concat_13_dma_init_in_0_122 = {
      /* from memory with batch=128
iterating outer iter=0 num_higher_elem=4
spanning across 401408 bytes */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34200000UL) /* Equivalent hex address = 0x34200000UL */}, /* Mul_115_out_0 */
      .offset_start = 200704,
      .offset_end = 301056,
      .offset_limit = 301120,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 100352,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 1,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(9, &Resize_116_resize_NN_expansion_concat_13_dma_init_in_0_122, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM3 -> 401408 */

    /* Dma output units from cycle: */
    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Resize_116_resize_NN_expansion_concat_13 output ports=0 range=1[0,401408] */

    static const LL_Streng_TensorInitTypeDef Resize_116_resize_NN_expansion_concat_13_dma_init_out_0_122 = {
      /* to memory canonical from batch=128 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Resize_116_resize_NN_expansion_concat_13_out_14 */
      .offset_start = 0,
      .offset_limit = 401472,
      .frame_count = 0,
      .fwidth = 14,
      .fheight = 14,
      .batch_depth = 256,
      .batch_offset = 2048,
      .frame_offset = 512,
      .line_offset = 0,
      .loop_offset = 401408,
      .frame_loop_cnt = 4,
      .frame_tot_cnt = 4,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Resize_116_resize_NN_expansion_concat_13_dma_init_out_0_122, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 401408 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_122[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Resize_116_resize_NN_expansion_concat_13 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 9 out port=0 */
    };


    /* epoch=122 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_122, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_122_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_122_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x8);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_122[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 9, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Resize_116_resize_NN_expansion_concat_13 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 9 out port=0 */
    };


    /* epoch=122 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_122, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_122_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 9} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_122_all_units, 2);

  }
  ec_trace_end_epoch(122);
  ec_trace_end_blob("_ec_blob_network_122");
}

void trace_ec__ec_blob_network_135(void) {
  ec_trace_start_blob("_ec_blob_network_135");
  ec_trace_start_epoch(135);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_128 */
    /* node=Concat_128 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 4 [STREAM_ENG_V2 4] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_128 input ports=0 range=1[0,301056] */

    static const LL_Streng_TensorInitTypeDef Concat_128_dma_init_in_0_135 = {
      /* from memory with batch=32 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Split_121_out_0 */
      .offset_start = 0,
      .offset_end = 100352,
      .offset_limit = 301120,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 100352,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(4, &Concat_128_dma_init_in_0_135, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 301056 */

    /* Dma output units from cycle: */
    /* Unit= 8 [STREAM_ENG_V2 8] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_128 output ports=0 range=2[0,301056] */

    static const LL_Streng_TensorInitTypeDef Concat_128_dma_init_out_0_135 = {
      /* to memory canonical from batch=32 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34270000UL) /* Equivalent hex address = 0x34270000UL */}, /* Concat_128_out_0 */
      .offset_start = 0,
      .offset_limit = 301120,
      .frame_count = 0,
      .fwidth = 28,
      .fheight = 28,
      .batch_depth = 64,
      .batch_offset = 384,
      .frame_offset = 128,
      .line_offset = 0,
      .loop_offset = 301056,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(8, &Concat_128_dma_init_out_0_135, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM4 <- 301056 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_135[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_128 OUT: in unit=STREAM_ENG_V2 8 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=135 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_135, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_135_all_units[] = {
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_135_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x100);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_135[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_128 OUT: in unit=STREAM_ENG_V2 8 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=135 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_135, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_135_all_units[] = {
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_135_all_units, 2);

  }
  ec_trace_end_epoch(135);
  ec_trace_end_blob("_ec_blob_network_135");
}

void trace_ec__ec_blob_network_167(void) {
  ec_trace_start_blob("_ec_blob_network_167");
  ec_trace_start_epoch(167);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Reshape node=Reshape_147 */
    /* node=Reshape_147 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_162 */
    /* node=Concat_162 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 1 [STREAM_ENG_V2 1] */
    /* Emit conf for STREAM_ENG_V2 node=Reshape_147 input ports=0 range=1[200704,401408] */

    static const LL_Streng_TensorInitTypeDef Reshape_147_dma_init_in_0_167 = {
      /* memory canonical to batch=1 */
      .dir = 0,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Conv2D_146_out_0 */
      .offset_start = 200704,
      .offset_limit = 401472,
      .frame_count = 0,
      .fwidth = 28,
      .fheight = 28,
      .batch_depth = 2,
      .batch_offset = 256,
      .frame_offset = 4,
      .line_offset = 0,
      .loop_offset = 200704,
      .frame_loop_cnt = 64,
      .frame_tot_cnt = 64,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(1, &Reshape_147_dma_init_in_0_167, 1);

    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_162 input ports=0 range=2[200704,351232] */

    static const LL_Streng_TensorInitTypeDef Concat_162_dma_init_in_0_167 = {
      /* from memory with batch=64 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34270000UL) /* Equivalent hex address = 0x34270000UL */}, /* Split_155_out_0 */
      .offset_start = 200704,
      .offset_end = 250880,
      .offset_limit = 351296,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 50176,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Concat_162_dma_init_in_0_167, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 200704 */
    /* npuRAM4 -> 150528 */

    /* Dma output units from cycle: */
    /* Unit= 7 [STREAM_ENG_V2 7] */
    /* Emit conf for STREAM_ENG_V2 node=Reshape_147 output ports=0 range=2[0,200704] */

    static const LL_Streng_TensorInitTypeDef Reshape_147_dma_init_out_0_167 = {
      /* to memory with batch=1 */
      .dir = 1,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34270000UL) /* Equivalent hex address = 0x34270000UL */}, /* Reshape_147_out_0 */
      .offset_start = 0,
      .offset_end = 200704,
      .offset_limit = 200768,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 200704,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 1,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(7, &Reshape_147_dma_init_out_0_167, 1);

    /* Unit= 5 [STREAM_ENG_V2 5] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_162 output ports=0 range=1[0,150528] */

    static const LL_Streng_TensorInitTypeDef Concat_162_dma_init_out_0_167 = {
      /* to memory canonical from batch=64 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Concat_162_out_0 */
      .offset_start = 0,
      .offset_limit = 150592,
      .frame_count = 0,
      .fwidth = 14,
      .fheight = 14,
      .batch_depth = 128,
      .batch_offset = 768,
      .frame_offset = 256,
      .line_offset = 0,
      .loop_offset = 150528,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(5, &Concat_162_dma_init_out_0_167, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 150528 */
    /* npuRAM4 <- 200704 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_167[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 1, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Reshape_147 OUT: in unit=STREAM_ENG_V2 7 in port=0 out unit=STREAM_ENG_V2 1 out port=0 */
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 5, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_162 OUT: in unit=STREAM_ENG_V2 5 in port=0 out unit=STREAM_ENG_V2 3 out port=0 */
    };


    /* epoch=167 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_167, 2);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_167_all_units[] = {
      { {STRENG, 5} }, /* STREAM_ENG_V2 */
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
      { {STRENG, 1} }, /* STREAM_ENG_V2 */
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_167_all_units, 4);

  }

  ec_trace_wait_epoch_end(0xa0);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_167[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 1, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Reshape_147 OUT: in unit=STREAM_ENG_V2 7 in port=0 out unit=STREAM_ENG_V2 1 out port=0 */
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 5, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_162 OUT: in unit=STREAM_ENG_V2 5 in port=0 out unit=STREAM_ENG_V2 3 out port=0 */
    };


    /* epoch=167 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_167, 2);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_167_all_units[] = {
      { {STRENG, 5} }, /* STREAM_ENG_V2 */
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
      { {STRENG, 1} }, /* STREAM_ENG_V2 */
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_167_all_units, 4);

  }
  ec_trace_end_epoch(167);
  ec_trace_end_blob("_ec_blob_network_167");
}

void trace_ec__ec_blob_network_199(void) {
  ec_trace_start_blob("_ec_blob_network_199");
  ec_trace_start_epoch(199);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Reshape node=Reshape_181 */
    /* node=Reshape_181 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Concat node=Concat_196 */
    /* node=Concat_196 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 4 [STREAM_ENG_V2 4] */
    /* Emit conf for STREAM_ENG_V2 node=Reshape_181 input ports=0 range=1[313600,363776] */

    static const LL_Streng_TensorInitTypeDef Reshape_181_dma_init_in_0_199 = {
      /* memory canonical to batch=1 */
      .dir = 0,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Conv2D_180_out_0 */
      .offset_start = 313600,
      .offset_limit = 363840,
      .frame_count = 0,
      .fwidth = 14,
      .fheight = 14,
      .batch_depth = 2,
      .batch_offset = 256,
      .frame_offset = 4,
      .line_offset = 0,
      .loop_offset = 50176,
      .frame_loop_cnt = 64,
      .frame_tot_cnt = 64,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(4, &Reshape_181_dma_init_in_0_199, 1);

    /* Unit= 5 [STREAM_ENG_V2 5] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_196 input ports=0 range=1[75264,150528] */

    static const LL_Streng_TensorInitTypeDef Concat_196_dma_init_in_0_199 = {
      /* from memory with batch=128 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Split_189_out_0 */
      .offset_start = 75264,
      .offset_end = 100352,
      .offset_limit = 150592,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 25088,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(5, &Concat_196_dma_init_in_0_199, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 125440 */

    /* Dma output units from cycle: */
    /* Unit= 3 [STREAM_ENG_V2 3] */
    /* Emit conf for STREAM_ENG_V2 node=Reshape_181 output ports=0 range=1[263424,313600] */

    static const LL_Streng_TensorInitTypeDef Reshape_181_dma_init_out_0_199 = {
      /* to memory with batch=1 */
      .dir = 1,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Reshape_181_out_0 */
      .offset_start = 263424,
      .offset_end = 313600,
      .offset_limit = 313664,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 50176,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 1,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(3, &Reshape_181_dma_init_out_0_199, 1);

    /* Unit= 6 [STREAM_ENG_V2 6] */
    /* Emit conf for STREAM_ENG_V2 node=Concat_196 output ports=0 range=1[0,75264] */

    static const LL_Streng_TensorInitTypeDef Concat_196_dma_init_out_0_199 = {
      /* to memory canonical from batch=128 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Concat_196_out_0 */
      .offset_start = 0,
      .offset_limit = 75328,
      .frame_count = 0,
      .fwidth = 7,
      .fheight = 7,
      .batch_depth = 256,
      .batch_offset = 1536,
      .frame_offset = 512,
      .line_offset = 0,
      .loop_offset = 75264,
      .frame_loop_cnt = 3,
      .frame_tot_cnt = 3,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(6, &Concat_196_dma_init_out_0_199, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 125440 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_199[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Reshape_181 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 6, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 5, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_196 OUT: in unit=STREAM_ENG_V2 6 in port=0 out unit=STREAM_ENG_V2 5 out port=0 */
    };


    /* epoch=199 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_199, 2);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_199_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 6} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
      { {STRENG, 5} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_199_all_units, 4);

  }

  ec_trace_wait_epoch_end(0x48);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_199[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 3, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Reshape_181 OUT: in unit=STREAM_ENG_V2 3 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 6, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 5, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Concat_196 OUT: in unit=STREAM_ENG_V2 6 in port=0 out unit=STREAM_ENG_V2 5 out port=0 */
    };


    /* epoch=199 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_199, 2);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_199_all_units[] = {
      { {STRENG, 3} }, /* STREAM_ENG_V2 */
      { {STRENG, 6} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
      { {STRENG, 5} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_199_all_units, 4);

  }
  ec_trace_end_epoch(199);
  ec_trace_end_blob("_ec_blob_network_199");
}

void trace_ec__ec_blob_network_217(void) {
  ec_trace_start_blob("_ec_blob_network_217");
  ec_trace_start_epoch(217);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Reshape node=Reshape_217 */
    /* node=Reshape_217 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 4 [STREAM_ENG_V2 4] */
    /* Emit conf for STREAM_ENG_V2 node=Reshape_217 input ports=0 range=1[326144,338688] */

    static const LL_Streng_TensorInitTypeDef Reshape_217_dma_init_in_0_217 = {
      /* memory canonical to batch=1 */
      .dir = 0,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Conv2D_216_out_0 */
      .offset_start = 326144,
      .offset_limit = 338752,
      .frame_count = 0,
      .fwidth = 7,
      .fheight = 7,
      .batch_depth = 2,
      .batch_offset = 256,
      .frame_offset = 4,
      .line_offset = 0,
      .loop_offset = 12544,
      .frame_loop_cnt = 64,
      .frame_tot_cnt = 64,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(4, &Reshape_217_dma_init_in_0_217, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 12544 */

    /* Dma output units from cycle: */
    /* Unit= 7 [STREAM_ENG_V2 7] */
    /* Emit conf for STREAM_ENG_V2 node=Reshape_217 output ports=0 range=1[313600,326144] */

    static const LL_Streng_TensorInitTypeDef Reshape_217_dma_init_out_0_217 = {
      /* to memory with batch=1 */
      .dir = 1,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x342e0000UL) /* Equivalent hex address = 0x342e0000UL */}, /* Reshape_217_out_0 */
      .offset_start = 313600,
      .offset_end = 326144,
      .offset_limit = 326208,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 12544,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 1,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(7, &Reshape_217_dma_init_out_0_217, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM5 <- 12544 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_217[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Reshape_217 OUT: in unit=STREAM_ENG_V2 7 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=217 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_217, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_217_all_units[] = {
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_217_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x80);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_217[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 7, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Reshape_217 OUT: in unit=STREAM_ENG_V2 7 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=217 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_217, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_217_all_units[] = {
      { {STRENG, 7} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_217_all_units, 2);

  }
  ec_trace_end_epoch(217);
  ec_trace_end_blob("_ec_blob_network_217");
}

void trace_ec__ec_blob_network_222(void) {
  ec_trace_start_blob("_ec_blob_network_222");
  ec_trace_start_epoch(222);
  {
    /* Unit= 28 [NULL_UNIT 0] */
    /* kind=Identity node=Identity_inserted_id806 */
    /* node=Identity_inserted_id806 satisfies input and output adjacency (DMA->DMA) and can be omitted */

    /* Dma inputs units to cycle: */
    /* Unit= 4 [STREAM_ENG_V2 4] */
    /* Emit conf for STREAM_ENG_V2 node=Identity_inserted_id806 input ports=0 range=2[0,263424] */

    static const LL_Streng_TensorInitTypeDef Identity_inserted_id806_dma_init_in_0_222 = {
      /* from memory with batch=1 */
      .dir = 0,
      .raw = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34270000UL) /* Equivalent hex address = 0x34270000UL */}, /* Transpose_220_out_0_inserted_in806 */
      .offset_start = 0,
      .offset_end = 16464,
      .offset_limit = 263488,
      .frame_count = 0,
      .fwidth = 0,
      .fheight = 0,
      .batch_depth = 0,
      .batch_offset = 0,
      .frame_offset = 16464,
      .line_offset = 0,
      .loop_offset = 0,
      .frame_loop_cnt = 0,
      .frame_tot_cnt = 16,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(4, &Identity_inserted_id806_dma_init_in_0_222, 1);


    /* Dma input bandwidth from memory pools: */
    /* npuRAM4 -> 263424 */

    /* Dma output units from cycle: */
    /* Unit= 8 [STREAM_ENG_V2 8] */
    /* Emit conf for STREAM_ENG_V2 node=Identity_inserted_id806 output ports=0 range=3[0,263424] */

    static const LL_Streng_TensorInitTypeDef Identity_inserted_id806_dma_init_out_0_222 = {
      /* to memory canonical from batch=1 */
      .dir = 1,
      .noblk = 0,
      .align_right = 0,
      .nbits_unsigned = 0,
      .addr_base = {(unsigned char *)(0x34200000UL) /* Equivalent hex address = 0x34200000UL */}, /* Transpose_220_out_0_inserted_out806 */
      .offset_start = 0,
      .offset_limit = 263488,
      .frame_count = 0,
      .fwidth = 1029,
      .fheight = 4,
      .batch_depth = 2,
      .batch_offset = 64,
      .frame_offset = 4,
      .line_offset = 0,
      .loop_offset = 263424,
      .frame_loop_cnt = 16,
      .frame_tot_cnt = 16,
      .nbits_in = 16,
      .nbits_out = 16,
    };

    /* Unit=STREAM_ENG_V2 */
    LL_Streng_TensorInit(8, &Identity_inserted_id806_dma_init_out_0_222, 1);


    /* Dma output bandwidth to memory pools: */
    /* npuRAM3 <- 263424 */

    static const LL_Switch_InitTypeDef STREAM_SWITCH_0_init_in_222[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Identity_inserted_id806 OUT: in unit=STREAM_ENG_V2 8 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=222 */
    LL_Switch_Init(STREAM_SWITCH_0_init_in_222, 1);

    static const LL_ATON_EnableUnits_InitTypeDef Enable_epoch_222_all_units[] = {
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_EnableUnits_Init(Enable_epoch_222_all_units, 2);

  }

  ec_trace_wait_epoch_end(0x100);

  {
    static const LL_Switch_DeinitTypeDef STREAM_SWITCH_0_deinit_in_222[] = {
      { LL_Switch_Init_Dest() = ATONN_DSTPORT(STRSWITCH, 0, STRENG, 8, 0), LL_Switch_Init_Source(0) = ATONN_SRCPORT(STRSWITCH, 0, STRENG, 4, 0), LL_Switch_Init_Context(0) = 1, LL_Switch_Init_Frames(0) = 0, }, /* Identity_inserted_id806 OUT: in unit=STREAM_ENG_V2 8 in port=0 out unit=STREAM_ENG_V2 4 out port=0 */
    };


    /* epoch=222 */
    LL_Switch_Deinit(STREAM_SWITCH_0_deinit_in_222, 1);

    static const LL_ATON_DisableUnits_InitTypeDef Disable_epoch_222_all_units[] = {
      { {STRENG, 8} }, /* STREAM_ENG_V2 */
      { {STRENG, 4} }, /* STREAM_ENG_V2 */
    };


    LL_ATON_DisableUnits_Init(Disable_epoch_222_all_units, 2);

  }
  ec_trace_end_epoch(222);
  ec_trace_end_blob("_ec_blob_network_222");
}

void trace_ec__ec_blob_network_225(void) {
  ec_trace_start_blob("_ec_blob_network_225");
  ec_trace_start_epoch(225);
  {
  }
  {
  }
  ec_trace_end_epoch(225);
  ec_trace_start_epoch(226);
  {
  }
  {
  }
  ec_trace_end_epoch(226);
  ec_trace_end_blob("_ec_blob_network_225");
}

void trace_ec__ec_blob_network_232(void) {
  ec_trace_start_blob("_ec_blob_network_232");
  ec_trace_start_epoch(232);
  {
  }
  {
  }
  ec_trace_end_epoch(232);
  ec_trace_end_blob("_ec_blob_network_232");
}

void trace_ec__ec_blob_network_234(void) {
  ec_trace_start_blob("_ec_blob_network_234");
  ec_trace_start_epoch(234);
  {
  }
  {
  }
  ec_trace_end_epoch(234);
  ec_trace_start_epoch(235);
  {
    /* Dma input bandwidth from memory pools: */
    /* npuRAM5 -> 0 */

  }
  {
  }
  ec_trace_end_epoch(235);
  ec_trace_end_blob("_ec_blob_network_234");
}


int main () {
  ec_trace_init("network_ecblobs.h", "network", false, 0, false);
  trace_ec__ec_blob_network_1();
  trace_ec__ec_blob_network_19();
  trace_ec__ec_blob_network_44();
  trace_ec__ec_blob_network_69();
  trace_ec__ec_blob_network_87();
  trace_ec__ec_blob_network_101();
  trace_ec__ec_blob_network_105();
  trace_ec__ec_blob_network_118();
  trace_ec__ec_blob_network_122();
  trace_ec__ec_blob_network_135();
  trace_ec__ec_blob_network_167();
  trace_ec__ec_blob_network_199();
  trace_ec__ec_blob_network_217();
  trace_ec__ec_blob_network_222();
  trace_ec__ec_blob_network_225();
  trace_ec__ec_blob_network_232();
  trace_ec__ec_blob_network_234();
  ec_trace_all_blobs_done();
}
