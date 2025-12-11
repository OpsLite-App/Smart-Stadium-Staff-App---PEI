package com.stadium.emergency_service.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class IncidentResponseDTO {

    private String id; // UUID from Python service
    private String incidentType;
    private String locationNode;
    private String location; // Legacy support
    private String severity;
    private String priority; // Legacy support
    private String status;
    private Integer assignedTo;

    private String description;
    private String locationDescription;
    private String affectedArea;
    private String detectedBy;
    private String sensorId;
    private String reportedBy;

    private Boolean evacuationTriggered;
    private Integer respondersDispatched;

    private Map<String, Object> incidentMetadata;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime detectedAt;
}
