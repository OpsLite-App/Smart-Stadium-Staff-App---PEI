/**
 * mqtt_publisher.c
 * Publica contagens de pessoas via MQTT após inferência do modelo.
 *
 * Usa coreMQTT + LwIP. Antes de compilar:
 *   1. Ativar ETH + LwIP no STM32CubeMX e regenerar código
 *   2. Adicionar coreMQTT/source/*.c ao projeto
 *   3. Adicionar coreMQTT/source/include/ ao include path
 *   4. Implementar os callbacks de rede LwIP em mqtt_transport.c (ver comentários abaixo)
 */

#include "mqtt_publisher.h"
#include "stm32n6xx_hal.h"
#include <stdio.h>
#include <string.h>

#ifdef USE_MQTT
#include "core_mqtt.h"       /* coreMQTT */
#include "lwip/sockets.h"    /* LwIP BSD socket API */
#include "lwip/netdb.h"
#endif

/* NOTE: coreMQTT and LwIP-dependent state and callbacks are defined
 * only when `USE_MQTT` is enabled. When `USE_MQTT` is not defined
 * the file provides lightweight stub implementations so the app
 * can build without networking dependencies.
 */

/* ── Implementação pública ── */

#ifndef USE_MQTT
int MQTT_Publisher_Init(void)
{
    /* Stub implementation when coreMQTT is not available. */
    (void)0;
    return 0;
}

void MQTT_Publisher_SendCount(uint32_t person_count)
{
    (void)person_count; /* no-op */
}

#else /* USE_MQTT */

int MQTT_Publisher_Init(void)
{
    /* 1. Abrir socket TCP para o broker */
    struct sockaddr_in broker_addr = {0};
    broker_addr.sin_family = AF_INET;
    broker_addr.sin_port   = htons(MQTT_BROKER_PORT);
    inet_aton(MQTT_BROKER_IP, &broker_addr.sin_addr);

    mqtt_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (mqtt_socket < 0) {
        printf("[MQTT] Erro ao criar socket\n");
        return -1;
    }

    if (connect(mqtt_socket, (struct sockaddr *)&broker_addr, sizeof(broker_addr)) != 0) {
        printf("[MQTT] Erro ao ligar ao broker %s:%d\n", MQTT_BROKER_IP, MQTT_BROKER_PORT);
        return -1;
    }

    /* 2. Inicializar coreMQTT */
    TransportInterface_t transport = {
        .recv    = transport_recv,
        .send    = transport_send,
        .pNetworkContext = NULL
    };

    mqtt_buf.pBuffer = mqtt_network_buf;
    mqtt_buf.size    = sizeof(mqtt_network_buf);

    MQTT_Init(&mqtt_ctx, &transport, get_time_ms, NULL, &mqtt_buf);

    /* 3. Enviar CONNECT */
    MQTTConnectInfo_t conn_info = {0};
    conn_info.cleanSession      = true;
    conn_info.pClientIdentifier = "stm32n6-" MQTT_ZONE_ID;
    conn_info.clientIdentifierLength = strlen(conn_info.pClientIdentifier);
    conn_info.keepAliveSeconds  = 60;

    bool session_present = false;
    MQTTStatus_t status = MQTT_Connect(&mqtt_ctx, &conn_info, NULL, 5000, &session_present);
    if (status != MQTTSuccess) {
        printf("[MQTT] CONNECT falhou: %d\n", status);
        return -1;
    }

    printf("[MQTT] Ligado ao broker. Zone: %s, Topic: %s\n", MQTT_ZONE_ID, MQTT_TOPIC);
    return 0;
}

void MQTT_Publisher_SendCount(uint32_t person_count)
{
    /* Throttle: só publica a cada publish_interval_ms */
    uint32_t now = HAL_GetTick();
    if ((now - last_publish_tick) < publish_interval_ms) {
        return;
    }
    last_publish_tick = now;

    /* Construir payload no formato que o Congestion Service espera */
    float occupancy = (person_count / (float)MQTT_ZONE_CAP) * 100.0f;
    if (occupancy > 100.0f) occupancy = 100.0f;

    const char *heat_level = occupancy > 80.0f ? "red"
                           : occupancy > 50.0f ? "yellow"
                           : "green";

    char payload[256];
    int len = snprintf(payload, sizeof(payload),
        "{"
        "\"event_type\":\"crowd_density\","
        "\"area_id\":\"%s\","
        "\"area_type\":\"gate\","
        "\"current_count\":%lu,"
        "\"capacity\":%d,"
        "\"occupancy_rate\":%.1f,"
        "\"heat_level\":\"%s\","
        "\"location\":{\"x\":%.4f,\"y\":%.4f}"
        "}",
        MQTT_ZONE_ID,
        (unsigned long)person_count,
        MQTT_ZONE_CAP,
        occupancy,
        heat_level,
        MQTT_ZONE_LAT,
        MQTT_ZONE_LON
    );

    MQTTPublishInfo_t pub = {0};
    pub.qos              = MQTTQoS0;
    pub.pTopicName       = MQTT_TOPIC;
    pub.topicNameLength  = strlen(MQTT_TOPIC);
    pub.pPayload         = payload;
    pub.payloadLength    = (size_t)len;

    MQTTStatus_t status = MQTT_Publish(&mqtt_ctx, &pub, 0);
    if (status == MQTTSuccess) {
        printf("[MQTT] Publicado: %s → %lu pessoas (%.1f%%)\n",
               MQTT_ZONE_ID, (unsigned long)person_count, occupancy);
    } else {
        printf("[MQTT] Erro ao publicar: %d\n", status);
    }

    /* Processar ACKs pendentes */
    MQTT_ProcessLoop(&mqtt_ctx);
}

#endif /* USE_MQTT */
