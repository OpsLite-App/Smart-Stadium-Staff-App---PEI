package com.stadium.gateway.mqtt;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MqttBridgeServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private MqttBridgeService mqttBridgeService;

    @Test
    void publish_ValidTopicAndPayload_DoesNotThrow() {
        // Arrange
        String topic = "stadium/test";
        String payload = "test message";

        // Act - This should not throw an exception
        mqttBridgeService.publish(topic, payload);

        // Assert - No exception thrown is the expected behavior
        // Since we can't easily mock the MqttClient without refactoring,
        // we just verify the method doesn't throw
    }
}