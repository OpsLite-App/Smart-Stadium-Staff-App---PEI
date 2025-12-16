package com.stadium.gateway.mqtt;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GatewayControllerUnitTest {

    @Mock
    private MqttBridgeService mqttBridge;

    @Test
    void assignStaff_ValidPayload_ReturnsOk() {
        // Arrange
        GatewayController controller = new GatewayController(mqttBridge);
        
        Map<String, Object> payload = Map.of(
            "staffId", "123",
            "section", "A1",
            "task", "Cleanup"
        );

        // Act
        ResponseEntity<?> response = controller.assignStaff(payload);

        // Assert
        assertNotNull(response);
        assertEquals(200, response.getStatusCodeValue());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertNotNull(body);
        assertEquals("published", body.get("status"));
    }

    @Test
    void assignStaff_NullPayload_ReturnsError() {
        // Arrange
        GatewayController controller = new GatewayController(mqttBridge);

        // Act
        ResponseEntity<?> response = controller.assignStaff(null);

        // Assert
        assertNotNull(response);
        assertEquals(500, response.getStatusCodeValue());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("error"));
    }
}