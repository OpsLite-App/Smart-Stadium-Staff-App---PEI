package com.stadium.emergency_service.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AssignIncidentDTO {

    @NotNull(message = "Incident ID is required")
    private Long incidentId;

    @NotNull(message = "User ID is required")
    private Integer userId;
}
