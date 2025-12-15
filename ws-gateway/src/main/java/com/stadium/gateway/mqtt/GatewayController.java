package com.stadium.gateway.mqtt;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/gateway")
public class GatewayController {

    private final MqttBridgeService mqttBridge;
    private final ObjectMapper mapper = new ObjectMapper();

    public GatewayController(MqttBridgeService mqttBridge) {
        this.mqttBridge = mqttBridge;
    }

    @PostMapping("/assign")
    public ResponseEntity<?> assignStaff(@RequestBody Map<String, Object> payload) {
        try {
            // Convert Map to proper JSON string
            String jsonPayload = mapper.writeValueAsString(payload);

            // Include event_type for maintenance-service
            if (!payload.containsKey("event_type")) {
                jsonPayload = mapper.writeValueAsString(Map.of(
                    "event_type", "staff_assignment",
                    "staffId", payload.get("staffId"),
                    "section", payload.get("section"),
                    "task", payload.get("task")
                ));
            }

            mqttBridge.publish("stadium/maintenance/staff-assignments", jsonPayload);
            return ResponseEntity.ok(Map.of("status", "published"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
