package com.stadium.emergency_service.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.Map;
import java.util.HashMap;

@Data
public class CreateIncidentDTO {

    @NotBlank(message = "Incident type is required")
    private String incidentType; // fire, smoke, gas_leak, structural, electrical, chemical, bomb_threat, other

    @NotBlank(message = "Location node is required")
    private String locationNode; // Graph node ID for location

    private String severity = "medium"; // low, medium, high, critical

    private String description;

    private String locationDescription; // Human-readable location

    private String affectedArea; // Zone/sector affected

    private String detectedBy = "system"; // sensor, staff, visitor, system

    private String sensorId;

    private String reportedBy;

    private Map<String, Object> incidentMetadata = new HashMap<>();
}
