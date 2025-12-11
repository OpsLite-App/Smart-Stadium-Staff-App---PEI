package com.stadium.emergency_service.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    private String id; // UUID from Python service

    private String incidentType; // fire, smoke, gas_leak, etc.
    private String locationNode; // Graph node ID
    private String location; // Legacy support
    private String severity; // low, medium, high, critical
    private String priority; // Legacy support
    private String status = "active"; // active, investigating, responding, contained, resolved
    private Integer assignedTo; // user ID

    private String description;
    private String locationDescription; // Human-readable location
    private String affectedArea; // Zone/sector
    private String detectedBy; // Detection source
    private String sensorId; // Linked sensor
    private String reportedBy; // Reporting staff

    private Boolean evacuationTriggered = false;
    private Integer respondersDispatched = 0;

    @Column(columnDefinition = "jsonb")
    private Map<String, Object> incidentMetadata = new HashMap<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime detectedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (detectedAt == null) {
            detectedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
