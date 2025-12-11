package com.stadium.emergency_service.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateIncidentDTO {

    @NotBlank(message = "Type is required")
    private String type; 

    @NotBlank(message = "Location is required")
    private String location;

    private String priority; 
}
