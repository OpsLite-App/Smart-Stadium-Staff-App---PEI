/**
 * mqtt_publisher.c — STUB
 */

#include "mqtt_publisher.h"
#include <stdio.h>

int MQTT_Publisher_Init(void)
{
    printf("[MQTT] Stub: MQTT não configurado\n");
    return 0;
}

void MQTT_Publisher_SendCount(uint32_t person_count)
{
    printf("[MQTT] Stub: %lu pessoas detetadas\n", (unsigned long)person_count);
}
