/**
 * mqtt_publisher.h
 * Publica contagens de pessoas via MQTT após inferência do modelo.
 *
 * Dependências necessárias no projeto STM32CubeIDE:
 *   - LwIP (Ethernet + TCP/IP stack) — ativar via STM32CubeMX
 *   - coreMQTT (https://github.com/FreeRTOS/coreMQTT) — adicionar Src/ ao projeto
 */

#ifndef MQTT_PUBLISHER_H
#define MQTT_PUBLISHER_H

#include <stdint.h>

/* ── Configuração — ajustar antes de flashar ── */
#define MQTT_BROKER_IP    "192.168.1.100"   /* IP do servidor onde corre o Mosquitto */
#define MQTT_BROKER_PORT  1883
#define MQTT_ZONE_ID      "gate_1"          /* ID único desta board/zona no estádio */
#define MQTT_TOPIC        "stadium/crowd/density-updates"
#define MQTT_ZONE_LAT     41.1618f          /* Coordenadas GPS da zona */
#define MQTT_ZONE_LON    -8.5839f
#define MQTT_ZONE_CAP     150               /* Capacidade máxima da zona */
/* ─────────────────────────────────────────── */

/**
 * Inicializa Ethernet + LwIP + ligação MQTT ao broker.
 * Chamar uma vez em Hardware_init(), após BSP_XSPI_RAM_Init().
 * Retorna 0 em sucesso, -1 em erro.
 */
int MQTT_Publisher_Init(void);

/**
 * Publica contagem de pessoas para a zona configurada.
 * Chamar no loop principal após app_postprocess_run().
 *
 * @param person_count  Número de pessoas detetadas (pp_output.nb_detect)
 */
void MQTT_Publisher_SendCount(uint32_t person_count);

#endif /* MQTT_PUBLISHER_H */
