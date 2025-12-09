package com.stadium.emergency_service.dto;

import lombok.Data;

@Data
public class IncidentResponseDTO {

    private Long id;
    private String type;
    private String location;
    private String priority;
    private String status;
    private Integer assignedTo;
}
