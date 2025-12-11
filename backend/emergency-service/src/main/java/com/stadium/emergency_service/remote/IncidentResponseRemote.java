package com.stadium.emergency_service.remote;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class IncidentResponseRemote {
    private String id; // UUID from Python

    @JsonProperty("incident_type")
    private String incident_type;

    @JsonProperty("location_node")
    private String location_node;

    private String location;
    private String severity;
    private String status;

    @JsonProperty("assigned_to")
    private Integer assigned_to;

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

    @JsonProperty("evacuation_triggered")
    private Boolean evacuation_triggered;

    @JsonProperty("responders_dispatched")
    private Integer responders_dispatched;

    @JsonProperty("incident_metadata")
    private Map<String, Object> incident_metadata;

    @JsonProperty("created_at")
    private LocalDateTime created_at;

    @JsonProperty("updated_at")
    private LocalDateTime updated_at;

    @JsonProperty("detected_at")
    private LocalDateTime detected_at;
}
