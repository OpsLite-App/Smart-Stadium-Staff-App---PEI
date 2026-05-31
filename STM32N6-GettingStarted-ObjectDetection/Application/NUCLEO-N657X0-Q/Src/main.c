/**
 ******************************************************************************
 * @attention ---
 *
 * Copyright (c) 2023 STMicroelectronics.
 * All rights reserved.
 *
 * This software is licensed under terms that can be found in the LICENSE file
 * in the root directory of this software component.
 * If no LICENSE file comes with this software, it is provided AS-IS.
 *
 ******************************************************************************
 */

#include <string.h>
#include <unistd.h>
#include <stdio.h>


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
#include "app_config.h"
#include "crop_img.h"
#include "zip_postprocess.h"
#include "mqtt_publisher.h"
#include "zip_postprocess.c"
#include "mqtt_publisher.c"

/* ---------------------------------------------------------------------------
 * Globals
 * ---------------------------------------------------------------------------*/
UART_HandleTypeDef huart1;
volatile int32_t cameraFrameReceived;
stai_ptr nn_in;
BSP_LCD_LayerConfig_t LayerConfig = {0};

/* model context */
STAI_NETWORK_CONTEXT_DECLARE(network_context, STAI_NETWORK_CONTEXT_SIZE)

/* LCD Background Buffer em PSRAM */
__attribute__ ((section (".psram_bss")))
__attribute__ ((aligned (32)))
static uint8_t lcd_bg_buffer[800 * 480 * 2];

/* LCD Foreground Buffer em PSRAM */
#define LCD_FG_WIDTH   SCREEN_WIDTH
#define LCD_FG_HEIGHT  SCREEN_HEIGHT
#define LCD_FG_FRAMEBUFFER_SIZE (LCD_FG_WIDTH * LCD_FG_HEIGHT * 2)

__attribute__ ((section (".psram_bss")))
__attribute__ ((aligned (32)))
static uint8_t lcd_fg_buffer[2][LCD_FG_WIDTH * LCD_FG_HEIGHT * 2];
static int lcd_fg_buffer_rd_idx;---

/* ---------------------------------------------------------------------------
 * Área LCD
 * ---------------------------------------------------------------------------*/
typedef struct
{
  uint32_t X0;
  uint32_t Y0;
  uint32_t XSize;
  uint32_t YSize;
} Rectangle_TypeDef;--

Rectangle_TypeDef lcd_bg_area = {
#if ASPECT_RATIO_MODE == ASPECT_RATIO_CROP || ASPECT_RATIO_MODE == ASPECT_RATIO_FIT
  .X0 = (LCD_FG_WIDTH - LCD_FG_HEIGHT) / 2,
#else
  .X0 = 0,
#endif
  .Y0 = 0,
  .XSize = 0,
  .YSize = 0,
};

Rectangle_TypeDef lcd_fg_area = {
  .X0    = 0,
  .Y0    = 0,
  .XSize = LCD_FG_WIDTH,
  .YSize = LCD_FG_HEIGHT,
};--

/* ---------------------------------------------------------------------------
 * Crop buffer
 * ---------------------------------------------------------------------------*/
#define ALIGN_TO_16(v) (((v) + 15) & ~15)

#if (STAI_NETWORK_IN_1_WIDTH * STAI_NETWORK_IN_1_CHANNEL) != \
     ALIGN_TO_16(STAI_NETWORK_IN_1_WIDTH * STAI_NETWORK_IN_1_CHANNEL)
  #define DCMIPP_NN_NEEDS_CROP 1
  #define DCMIPP_OUT_NN_LEN \
    (ALIGN_TO_16(STAI_NETWORK_IN_1_WIDTH * STAI_NETWORK_IN_1_CHANNEL) \
     * STAI_NETWORK_IN_1_HEIGHT)
  #define DCMIPP_OUT_NN_BUFF_LEN (DCMIPP_OUT_NN_LEN + 32 - DCMIPP_OUT_NN_LEN % 32)

  __attribute__ ((aligned (32)))
  static uint8_t dcmipp_out_nn[DCMIPP_OUT_NN_BUFF_LEN];
#else
  #define DCMIPP_NN_NEEDS_CROP 0
#endif

/* ---------------------------------------------------------------------------
 * Protótipos privados
 * ---------------------------------------------------------------------------*/
static void SystemClock_Config(void);
static void CONSOLE_Config(void);
static void NPURam_enable(void);
static void NPUCache_config(void);
static void LCD_init(void);
static void Security_Config(void);
static void set_clk_sleep_mode(void);
static void IAC_Config(void);
static void Hardware_init(void);
static void NeuralNetwork_init(uint32_t *nn_in_length, stai_ptr *nn_out,
                                stai_size *number_output, int32_t nn_out_len[]);
static void Display_ZIPOutput(uint32_t count);

/* ===========================================================================
 * MAIN
 * ===========================================================================*/
int main(void)
{
  Hardware_init();

  MQTT_Publisher_Init();

  /* --- NN Init ------------------------------------------------------------ */
  uint32_t nn_in_len    = 0;
  stai_size number_output = 0;
  stai_ptr nn_out[STAI_NETWORK_OUT_NUM]   = {0};
  int32_t  nn_out_len[STAI_NETWORK_OUT_NUM] = {0};

  NeuralNetwork_init(&nn_in_len, nn_out, &number_output, nn_out_len);

  /* --- Camera Init -------------------------------------------------------- */
  uint32_t pitch_nn = 0;
  CameraPipeline_Init(&lcd_bg_area.XSize, &lcd_bg_area.YSize, &pitch_nn);

  LCD_init();

  CameraPipeline_DisplayPipe_Start(lcd_bg_buffer, CMW_MODE_CONTINUOUS);

  /* --- App header --------------------------------------------------------- */
  printf("========================================\n");
  printf("STM32N6 - ZIP Density Estimation\n");
  printf("Zone: %s\n", MQTT_ZONE_ID);
  printf("Build: %s %s\n", __DATE__, __TIME__);
  printf("NN model: %s\n", STAI_NETWORK_ORIGIN_MODEL_NAME);
  printf("========================================\n");

  /* --- App Loop ----------------------------------------------------------- */
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
             STAI_NETWORK_IN_1_WIDTH, STAI_NETWORK_IN_1_HEIGHT,
             STAI_NETWORK_IN_1_CHANNEL);
    SCB_CleanInvalidateDCache_by_Addr(nn_in, nn_in_len);
#endif

    /* Inferência */
    int ret = stai_network_run(network_context, STAI_MODE_SYNC);
    assert(ret == 0);

    /* Postprocessing ZIP: soma o density map quantizado [1,1,16,16] */
    SCB_InvalidateDCache_by_Addr(nn_out[0], nn_out_len[0]);
    uint32_t count = ZIP_Postprocess_GetCount((const int8_t *)nn_out[0]);

    /* Publicar via MQTT */
    MQTT_Publisher_SendCount(count);

    /* Mostrar no LCD */
    Display_ZIPOutput(count);

    /* Invalidar cache do output para evitar evictions durante próxima inferência */
    SCB_InvalidateDCache_by_Addr(nn_out[0], nn_out_len[0]);
  }
}

/* ===========================================================================
 * DISPLAY
 * ===========================================================================*/
static void Display_ZIPOutput(uint32_t count)
{
  int ret;

  ret = HAL_LTDC_SetAddress_NoReload(
          &hlcd_ltdc,
          (uint32_t) lcd_fg_buffer[lcd_fg_buffer_rd_idx],
          LTDC_LAYER_2);
  assert(ret == HAL_OK);

  /* Limpa frame anterior */
  UTIL_LCD_FillRect(lcd_fg_area.X0, lcd_fg_area.Y0,
                    lcd_fg_area.XSize, lcd_fg_area.YSize, 0x00000000);

  /* Mostra contagem de pessoas */
  UTIL_LCD_SetBackColor(0x40000000);
  UTIL_LCDEx_PrintfAt(0, LINE(2),  CENTER_MODE, "Zona: %s", MQTT_ZONE_ID);
  UTIL_LCDEx_PrintfAt(0, LINE(10), CENTER_MODE, "Pessoas estimadas:");
  UTIL_LCDEx_PrintfAt(0, LINE(12), CENTER_MODE, "%lu", (unsigned long)count);
  UTIL_LCD_SetBackColor(0);

  SCB_CleanDCache_by_Addr(lcd_fg_buffer[lcd_fg_buffer_rd_idx],
                           LCD_FG_FRAMEBUFFER_SIZE);

  ret = HAL_LTDC_ReloadLayer(&hlcd_ltdc, LTDC_RELOAD_VERTICAL_BLANKING,
                              LTDC_LAYER_2);
  assert(ret == HAL_OK);

  lcd_fg_buffer_rd_idx = 1 - lcd_fg_buffer_rd_idx;
}

/* ===========================================================================
 * LCD INIT
 * ===========================================================================*/
static void LCD_init(void)
{
  BSP_LCD_Init(0, LCD_ORIENTATION_LANDSCAPE);

  /* Layer 1 — preview da câmara */
  LayerConfig.X0          = lcd_bg_area.X0;
  LayerConfig.Y0          = lcd_bg_area.Y0;
  LayerConfig.X1          = lcd_bg_area.X0 + lcd_bg_area.XSize;
  LayerConfig.Y1          = lcd_bg_area.Y0 + lcd_bg_area.YSize;
  LayerConfig.PixelFormat = LCD_PIXEL_FORMAT_RGB565;
  LayerConfig.Address     = (uint32_t) lcd_bg_buffer;
  BSP_LCD_ConfigLayer(0, LTDC_LAYER_1, &LayerConfig);

  /* Layer 2 — overlay texto/UI */
  LayerConfig.X0          = lcd_fg_area.X0;
  LayerConfig.Y0          = lcd_fg_area.Y0;
  LayerConfig.X1          = lcd_fg_area.X0 + lcd_fg_area.XSize;
  LayerConfig.Y1          = lcd_fg_area.Y0 + lcd_fg_area.YSize;
  LayerConfig.PixelFormat = LCD_PIXEL_FORMAT_ARGB4444;
  LayerConfig.Address     = (uint32_t) lcd_fg_buffer;
  BSP_LCD_ConfigLayer(0, LTDC_LAYER_2, &LayerConfig);

  UTIL_LCD_SetFuncDriver(&LCD_Driver);
  UTIL_LCD_SetLayer(LTDC_LAYER_2);
  UTIL_LCD_Clear(0x00000000);
  UTIL_LCD_SetFont(&Font20);
  UTIL_LCD_SetTextColor(UTIL_LCD_COLOR_WHITE);
}

/* ===========================================================================
 * HARDWARE INIT
 * ===========================================================================*/
static void Hardware_init(void)
{
  /* Power on ICACHE */
  MEMSYSCTL->MSCR |= MEMSYSCTL_MSCR_ICACTIVE_Msk;

  __HAL_RCC_CPUCLK_CONFIG(RCC_CPUCLKSOURCE_HSI);
  __HAL_RCC_SYSCLK_CONFIG(RCC_SYSCLKSOURCE_HSI);

  HAL_Init();
  SCB_EnableICache();

#if defined(USE_DCACHE)
  MEMSYSCTL->MSCR |= MEMSYSCTL_MSCR_DCACTIVE_Msk;
  SCB_EnableDCache();
#endif

  SystemClock_Config();
  CONSOLE_Config();
  NPURam_enable();
  Fuse_Programming();
  NPUCache_config();

  /* External RAM e NOR Flash */
  BSP_XSPI_RAM_Init(0);
  BSP_XSPI_RAM_EnableMemoryMappedMode(0);

  BSP_XSPI_NOR_Init_t NOR_Init;
  NOR_Init.InterfaceMode = BSP_XSPI_NOR_OPI_MODE;
  NOR_Init.TransferRate  = BSP_XSPI_NOR_DTR_TRANSFER;
  BSP_XSPI_NOR_Init(0, &NOR_Init);
  BSP_XSPI_NOR_EnableMemoryMappedMode(0);

  Security_Config();
  IAC_Config();
  set_clk_sleep_mode();
}

/* ===========================================================================
 * NEURAL NETWORK INIT
 * ===========================================================================*/
static void NeuralNetwork_init(uint32_t *nn_in_length, stai_ptr *nn_out,
                                stai_size *number_output, int32_t nn_out_len[])
{
  stai_network_info info;
  int ret;

  ret = stai_runtime_init();
  assert(ret == STAI_SUCCESS);

  ret = stai_network_init(network_context);
  assert(ret == STAI_SUCCESS);

  ret = stai_network_get_info(network_context, &info);
  assert(ret == STAI_SUCCESS);
  assert(info.n_inputs == 1);

  *number_output = STAI_NETWORK_OUT_NUM;

  *nn_in_length = info.inputs[0].size_bytes;
  ret = stai_network_get_inputs(network_context, &nn_in,
                                (stai_size *)&info.n_inputs);
  assert(ret == STAI_SUCCESS);

  ret = stai_network_get_outputs(network_context, nn_out, number_output);
  assert(ret == STAI_SUCCESS);

  for (int i = 0; i < (int)*number_output; i++)
  {
    nn_out_len[i] = info.outputs[i].size_bytes;
  }
}

/* ===========================================================================
 * SYSTEM CLOCK
 * ===========================================================================*/
static void SystemClock_Config(void)
{
  RCC_ClkInitTypeDef     RCC_ClkInitStruct    = {0};
  RCC_OscInitTypeDef     RCC_OscInitStruct    = {0};
  RCC_PeriphCLKInitTypeDef RCC_PeriphCLKInitStruct = {0};

  BSP_SMPS_Init(SMPS_VOLTAGE_OVERDRIVE);

  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_NONE;

  /* PLL1 = 800 MHz */
  RCC_OscInitStruct.PLL1.PLLState   = RCC_PLL_ON;
  RCC_OscInitStruct.PLL1.PLLSource  = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL1.PLLM       = 2;
  RCC_OscInitStruct.PLL1.PLLN       = 25;
  RCC_OscInitStruct.PLL1.PLLFractional = 0;
  RCC_OscInitStruct.PLL1.PLLP1      = 1;
  RCC_OscInitStruct.PLL1.PLLP2      = 1;

  /* PLL2 = 1000 MHz */
  RCC_OscInitStruct.PLL2.PLLState   = RCC_PLL_ON;
  RCC_OscInitStruct.PLL2.PLLSource  = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL2.PLLM       = 8;
  RCC_OscInitStruct.PLL2.PLLFractional = 0;
  RCC_OscInitStruct.PLL2.PLLN       = 125;
  RCC_OscInitStruct.PLL2.PLLP1      = 1;
  RCC_OscInitStruct.PLL2.PLLP2      = 1;

  /* PLL3 = 900 MHz */
  RCC_OscInitStruct.PLL3.PLLState   = RCC_PLL_ON;
  RCC_OscInitStruct.PLL3.PLLSource  = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL3.PLLM       = 8;
  RCC_OscInitStruct.PLL3.PLLN       = 225;
  RCC_OscInitStruct.PLL3.PLLFractional = 0;
  RCC_OscInitStruct.PLL3.PLLP1      = 1;
  RCC_OscInitStruct.PLL3.PLLP2      = 2;

  /* PLL4 = 50 MHz */
  RCC_OscInitStruct.PLL4.PLLState   = RCC_PLL_ON;
  RCC_OscInitStruct.PLL4.PLLSource  = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL4.PLLM       = 8;
  RCC_OscInitStruct.PLL4.PLLFractional = 0;
  RCC_OscInitStruct.PLL4.PLLN       = 225;
  RCC_OscInitStruct.PLL4.PLLP1      = 6;
  RCC_OscInitStruct.PLL4.PLLP2      = 6;

  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK) { while(1); }

  RCC_ClkInitStruct.ClockType = (RCC_CLOCKTYPE_CPUCLK | RCC_CLOCKTYPE_SYSCLK |
                                  RCC_CLOCKTYPE_HCLK   | RCC_CLOCKTYPE_PCLK1  |
                                  RCC_CLOCKTYPE_PCLK2  | RCC_CLOCKTYPE_PCLK4  |
                                  RCC_CLOCKTYPE_PCLK5);

  RCC_ClkInitStruct.CPUCLKSource = RCC_CPUCLKSOURCE_IC1;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_IC2_IC6_IC11;

  RCC_ClkInitStruct.IC1Selection.ClockSelection  = RCC_ICCLKSOURCE_PLL1;
  RCC_ClkInitStruct.IC1Selection.ClockDivider    = 1;
  RCC_ClkInitStruct.IC2Selection.ClockSelection  = RCC_ICCLKSOURCE_PLL1;
  RCC_ClkInitStruct.IC2Selection.ClockDivider    = 2;
  RCC_ClkInitStruct.IC6Selection.ClockSelection  = RCC_ICCLKSOURCE_PLL2;
  RCC_ClkInitStruct.IC6Selection.ClockDivider    = 1;
  RCC_ClkInitStruct.IC11Selection.ClockSelection = RCC_ICCLKSOURCE_PLL3;
  RCC_ClkInitStruct.IC11Selection.ClockDivider   = 1;

  RCC_ClkInitStruct.AHBCLKDivider  = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_APB1_DIV1;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_APB2_DIV1;
  RCC_ClkInitStruct.APB4CLKDivider = RCC_APB4_DIV1;
  RCC_ClkInitStruct.APB5CLKDivider = RCC_APB5_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct) != HAL_OK) { while(1); }

  RCC_PeriphCLKInitStruct.PeriphClockSelection  = 0;
  RCC_PeriphCLKInitStruct.PeriphClockSelection |= RCC_PERIPHCLK_XSPI1;
  RCC_PeriphCLKInitStruct.Xspi1ClockSelection   = RCC_XSPI1CLKSOURCE_HCLK;
  RCC_PeriphCLKInitStruct.PeriphClockSelection |= RCC_PERIPHCLK_XSPI2;
  RCC_PeriphCLKInitStruct.Xspi2ClockSelection   = RCC_XSPI2CLKSOURCE_HCLK;

  if (HAL_RCCEx_PeriphCLKConfig(&RCC_PeriphCLKInitStruct) != HAL_OK) { while(1); }
}

/* ===========================================================================
 * DCMIPP CLOCK CONFIG
 * ===========================================================================*/
HAL_StatusTypeDef MX_DCMIPP_ClockConfig(DCMIPP_HandleTypeDef *hdcmipp)
{
  RCC_PeriphCLKInitTypeDef RCC_PeriphCLKInitStruct = {0};
  HAL_StatusTypeDef ret = HAL_OK;

  RCC_PeriphCLKInitStruct.PeriphClockSelection        = RCC_PERIPHCLK_DCMIPP;
  RCC_PeriphCLKInitStruct.DcmippClockSelection        = RCC_DCMIPPCLKSOURCE_IC17;
  RCC_PeriphCLKInitStruct.ICSelection[RCC_IC17].ClockSelection = RCC_ICCLKSOURCE_PLL2;
  RCC_PeriphCLKInitStruct.ICSelection[RCC_IC17].ClockDivider   = 3;
  ret = HAL_RCCEx_PeriphCLKConfig(&RCC_PeriphCLKInitStruct);
  if (ret) return ret;

  RCC_PeriphCLKInitStruct.PeriphClockSelection        = RCC_PERIPHCLK_CSI;
  RCC_PeriphCLKInitStruct.ICSelection[RCC_IC18].ClockSelection = RCC_ICCLKSOURCE_PLL1;
  RCC_PeriphCLKInitStruct.ICSelection[RCC_IC18].ClockDivider   = 40;
  ret = HAL_RCCEx_PeriphCLKConfig(&RCC_PeriphCLKInitStruct);

  return ret;
}

/* ===========================================================================
 * CONSOLE / UART
 * ===========================================================================*/
static void CONSOLE_Config(void)
{
  GPIO_InitTypeDef gpio_init;

  __HAL_RCC_USART1_CLK_ENABLE();
  __HAL_RCC_GPIOE_CLK_ENABLE();

  gpio_init.Mode      = GPIO_MODE_AF_PP;
  gpio_init.Pull      = GPIO_PULLUP;
  gpio_init.Speed     = GPIO_SPEED_FREQ_HIGH;
  gpio_init.Pin       = GPIO_PIN_5 | GPIO_PIN_6;
  gpio_init.Alternate = GPIO_AF7_USART1;
  HAL_GPIO_Init(GPIOE, &gpio_init);

  huart1.Instance          = USART1;
  huart1.Init.BaudRate     = 115200;
  huart1.Init.Mode         = UART_MODE_TX_RX;
  huart1.Init.Parity       = UART_PARITY_NONE;
  huart1.Init.WordLength   = UART_WORDLENGTH_8B;
  huart1.Init.StopBits     = UART_STOPBITS_1;
  huart1.Init.HwFlowCtl    = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_8;
  if (HAL_UART_Init(&huart1) != HAL_OK) { while(1); }
}

int _write(int file, char *ptr, int len)
{
  HAL_StatusTypeDef status;
  if ((file != STDOUT_FILENO) && (file != STDERR_FILENO))
  {
    errno = EBADF;
    return -1;
  }
  status = HAL_UART_Transmit(&huart1, (uint8_t*)ptr, len, ~0);
  return (status == HAL_OK ? len : 0);
}

/* ===========================================================================
 * NPU RAM
 * ===========================================================================*/
static void NPURam_enable(void)
{
  __HAL_RCC_NPU_CLK_ENABLE();
  __HAL_RCC_NPU_FORCE_RESET();
  __HAL_RCC_NPU_RELEASE_RESET();

  __HAL_RCC_AXISRAM3_MEM_CLK_ENABLE();
  __HAL_RCC_AXISRAM4_MEM_CLK_ENABLE();
  __HAL_RCC_AXISRAM5_MEM_CLK_ENABLE();
  __HAL_RCC_AXISRAM6_MEM_CLK_ENABLE();
  __HAL_RCC_RAMCFG_CLK_ENABLE();

  RAMCFG_HandleTypeDef hramcfg = {0};
  hramcfg.Instance = RAMCFG_SRAM3_AXI; HAL_RAMCFG_EnableAXISRAM(&hramcfg);
  hramcfg.Instance = RAMCFG_SRAM4_AXI; HAL_RAMCFG_EnableAXISRAM(&hramcfg);
  hramcfg.Instance = RAMCFG_SRAM5_AXI; HAL_RAMCFG_EnableAXISRAM(&hramcfg);
  hramcfg.Instance = RAMCFG_SRAM6_AXI; HAL_RAMCFG_EnableAXISRAM(&hramcfg);
}

/* ===========================================================================
 * NPU CACHE
 * ===========================================================================*/
static void NPUCache_config(void)
{
  npu_cache_enable();
}

void npu_cache_enable_clocks_and_reset(void)
{
  __HAL_RCC_CACHEAXIRAM_MEM_CLK_ENABLE();
  __HAL_RCC_CACHEAXI_CLK_ENABLE();
  __HAL_RCC_CACHEAXI_FORCE_RESET();
  __HAL_RCC_CACHEAXI_RELEASE_RESET();
}

void npu_cache_disable_clocks_and_reset(void)
{
  __HAL_RCC_CACHEAXIRAM_MEM_CLK_DISABLE();
  __HAL_RCC_CACHEAXI_CLK_DISABLE();
  __HAL_RCC_CACHEAXI_FORCE_RESET();
}

/* ===========================================================================
 * SECURITY
 * ===========================================================================*/
static void Security_Config(void)
{
  __HAL_RCC_RIFSC_CLK_ENABLE();
  RIMC_MasterConfig_t RIMC_master = {0};
  RIMC_master.MasterCID = RIF_CID_1;
  RIMC_master.SecPriv   = RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV;

  HAL_RIF_RIMC_ConfigMasterAttributes(RIF_MASTER_INDEX_NPU,   &RIMC_master);
  HAL_RIF_RIMC_ConfigMasterAttributes(RIF_MASTER_INDEX_DMA2D, &RIMC_master);
  HAL_RIF_RIMC_ConfigMasterAttributes(RIF_MASTER_INDEX_DCMIPP,&RIMC_master);
  HAL_RIF_RIMC_ConfigMasterAttributes(RIF_MASTER_INDEX_LTDC1, &RIMC_master);
  HAL_RIF_RIMC_ConfigMasterAttributes(RIF_MASTER_INDEX_LTDC2, &RIMC_master);

  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_NPU,    RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_DMA2D,  RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_CSI,    RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_DCMIPP, RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_LTDC,   RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_LTDCL1, RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
  HAL_RIF_RISC_SetSlaveSecureAttributes(RIF_RISC_PERIPH_INDEX_LTDCL2, RIF_ATTRIBUTE_SEC | RIF_ATTRIBUTE_PRIV);
}

/* ===========================================================================
 * IAC
 * ===========================================================================*/
static void IAC_Config(void)
{
  __HAL_RCC_IAC_CLK_ENABLE();
  __HAL_RCC_IAC_FORCE_RESET();
  __HAL_RCC_IAC_RELEASE_RESET();
}

void IAC_IRQHandler(void)
{
  while (1) {}
}

/* ===========================================================================
 * SLEEP MODE CLOCKS
 * ===========================================================================*/
static void set_clk_sleep_mode(void)
{
  __HAL_RCC_XSPI1_CLK_SLEEP_ENABLE();
  __HAL_RCC_XSPI2_CLK_SLEEP_ENABLE();
  __HAL_RCC_NPU_CLK_SLEEP_ENABLE();
  __HAL_RCC_CACHEAXI_CLK_SLEEP_ENABLE();
  __HAL_RCC_LTDC_CLK_SLEEP_ENABLE();
  __HAL_RCC_DMA2D_CLK_SLEEP_ENABLE();
  __HAL_RCC_DCMIPP_CLK_SLEEP_ENABLE();
  __HAL_RCC_CSI_CLK_SLEEP_ENABLE();

  __HAL_RCC_FLEXRAM_MEM_CLK_SLEEP_ENABLE();
  __HAL_RCC_AXISRAM1_MEM_CLK_SLEEP_ENABLE();
  __HAL_RCC_AXISRAM2_MEM_CLK_SLEEP_ENABLE();
  __HAL_RCC_AXISRAM3_MEM_CLK_SLEEP_ENABLE();
  __HAL_RCC_AXISRAM4_MEM_CLK_SLEEP_ENABLE();
  __HAL_RCC_AXISRAM5_MEM_CLK_SLEEP_ENABLE();
  __HAL_RCC_AXISRAM6_MEM_CLK_SLEEP_ENABLE();
}

/* ===========================================================================
 * ASSERT
 * ===========================================================================*/
#ifdef USE_FULL_ASSERT
void assert_failed(uint8_t *file, uint32_t line)
{
  UNUSED(file);
  UNUSED(line);
  __BKPT(0);
  while (1) {}
}
#endif
