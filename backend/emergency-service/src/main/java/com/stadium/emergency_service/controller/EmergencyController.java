package com.stadium.emergency_service.controller;

import com.stadium.emergency_service.dto.*;
import com.stadium.emergency_service.model.Incident;
import com.stadium.emergency_service.service.EmergencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/emergency")
@RequiredArgsConstructor
public class EmergencyController {

    private final EmergencyService service;

    @PostMapping("/sos")
    public IncidentResponseDTO createIncident(@RequestBody @Valid CreateIncidentDTO dto) {
        Incident incident = new Incident();
        incident.setType(dto.getType());
        incident.setLocation(dto.getLocation());
        incident.setPriority(dto.getPriority());

        Incident saved = service.createIncident(incident);
        return mapToDTO(saved);
    }

    @GetMapping("/active")
    public List<IncidentResponseDTO> getActiveIncidents() {
        return service.getActiveIncidents()
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @PostMapping("/assign")
    public IncidentResponseDTO assignResponder(@RequestBody @Valid AssignIncidentDTO dto) {
        Incident updated = service.assignResponder(dto.getIncidentId(), dto.getUserId());
        return mapToDTO(updated);
    }

    private IncidentResponseDTO mapToDTO(Incident incident) {
        IncidentResponseDTO dto = new IncidentResponseDTO();
        dto.setId(incident.getId());
        dto.setType(incident.getType());
        dto.setLocation(incident.getLocation());
        dto.setPriority(incident.getPriority());
        dto.setStatus(incident.getStatus());
        dto.setAssignedTo(incident.getAssignedTo());
        return dto;
    }
}
