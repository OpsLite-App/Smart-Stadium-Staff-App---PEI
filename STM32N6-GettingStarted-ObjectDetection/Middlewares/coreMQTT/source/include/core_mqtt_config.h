/**
 * core_mqtt_config.h
 * Configuração mínima do coreMQTT para STM32N6.
 */
#ifndef CORE_MQTT_CONFIG_H
#define CORE_MQTT_CONFIG_H

/* Tamanho máximo do tópico MQTT */
#define MQTT_MAX_TOPIC_LENGTH       256

/* Timeout de receive em ms */
#define MQTT_RECV_POLLING_TIMEOUT_MS  1000

/* Log — redireciona para printf (já configurado via UART no projeto) */
#define LogError( msg )   printf msg
#define LogWarn( msg )    printf msg
#define LogInfo( msg )    printf msg
#define LogDebug( msg )   /* desativado */

#endif /* CORE_MQTT_CONFIG_H */
