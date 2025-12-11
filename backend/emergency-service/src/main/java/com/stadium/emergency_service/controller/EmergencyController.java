package com.stadium.emergency_service.controller;

import com.stadium.emergency_service.dto.*;
import com.stadium.emergency_service.service.EmergencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/emergency")
@RequiredArgsConstructor
public class EmergencyController {

    private final EmergencyService service;

    @PostMapping("/sos")
    public IncidentResponseDTO createIncident(@RequestBody @Valid CreateIncidentDTO dto) {
        return service.createIncident(dto);
    }

    @GetMapping("/active")
    public List<IncidentResponseDTO> getActiveIncidents() {
        return service.getActiveIncidents();
    }

    @PostMapping("/assign")
    public IncidentResponseDTO assignResponder(@RequestBody @Valid AssignIncidentDTO dto) {
        return service.assignResponder(dto.getIncidentId(), dto.getUserId());
    }
}
