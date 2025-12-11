package com.stadium.emergency_service.remote;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

/**
 * Full payload posted to Python /api/emergency/incidents
 * Maps CreateIncidentDTO fields to Python IncidentCreate schema
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class IncidentCreatePayload {
    private String incident_type; // fire, smoke, gas_leak, etc.
    
    @JsonProperty("location_node")
    private String location_node; // Graph node ID
    
    private String location; // Legacy support
    private String severity; // low, medium, high, critical
    private String description;
    
    @JsonProperty("location_description")
    private String location_description;
    
    @JsonProperty("affected_area")
    private String affected_area;
    
    @JsonProperty("detected_by")
    private String detected_by;
    
    @JsonProperty("sensor_id")
    private String sensor_id;
    
    @JsonProperty("reported_by")
    private String reported_by;
    
    @JsonProperty("incident_metadata")
    private Map<String, Object> incident_metadata;
}
