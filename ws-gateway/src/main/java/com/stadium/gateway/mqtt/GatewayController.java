package com.stadium.gateway.mqtt;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/gateway")
public class GatewayController {

    private final MqttBridgeService mqttBridge;

    public GatewayController(MqttBridgeService mqttBridge) {
        this.mqttBridge = mqttBridge;
    }

    @PostMapping("/assign")
    public ResponseEntity<?> assignStaff(@RequestBody Map<String, Object> payload) {
        // Publish to staff assignments topic
        mqttBridge.publish("stadium/maintenance/staff-assignments", payload.toString());
        return ResponseEntity.ok(Map.of("status", "published"));
    }
}
