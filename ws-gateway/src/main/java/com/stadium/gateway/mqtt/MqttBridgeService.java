package com.stadium.gateway.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.paho.client.mqttv3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Component
public class MqttBridgeService implements MqttCallback {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper mapper = new ObjectMapper();
    private MqttClient client;

    @Value("${mqtt.broker:tcp://localhost:1883}")
    private String mqttBroker;

    public MqttBridgeService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @PostConstruct
    public void init() {
        try {
            client = new MqttClient(mqttBroker, MqttClient.generateClientId());
            MqttConnectOptions options = new MqttConnectOptions();
            options.setAutomaticReconnect(true);
            options.setCleanSession(true);
            client.setCallback(this);
            client.connect(options);
            client.subscribe("stadium/#");
            System.out.println("Connected to MQTT and subscribed to stadium/#");
        } catch (Exception e) {
            System.out.println("MQTT connect failed: " + e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        try { if (client != null) client.disconnect(); } catch (Exception ignored) {}
    }

    @Override
    public void connectionLost(Throwable cause) {
        System.out.println("MQTT connection lost: " + cause.getMessage());
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) throws Exception {
        try {
            String payload = new String(message.getPayload());
            // Map topics to STOMP destinations
            if (topic.startsWith("stadium/crowd/")) {
                messagingTemplate.convertAndSend("/topic/crowd", payload);
            } else if (topic.startsWith("stadium/emergency/")) {
                messagingTemplate.convertAndSend("/topic/emergency", payload);
            } else if (topic.startsWith("stadium/maintenance/")) {
                messagingTemplate.convertAndSend("/topic/maintenance", payload);
            } else {
                messagingTemplate.convertAndSend("/topic/events", payload);
            }

            System.out.println("Forwarded MQTT " + topic + " to STOMP");
        } catch (Exception e) {
            System.out.println("Failed to forward mqtt message: " + e.getMessage());
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) { }

    public void publish(String topic, String payload) {
        try {
            if (client != null && client.isConnected()) {
                client.publish(topic, new MqttMessage(payload.getBytes()));
            }
        } catch (Exception e) {
            System.out.println("Failed to publish to MQTT: " + e.getMessage());
        }
    }
}
