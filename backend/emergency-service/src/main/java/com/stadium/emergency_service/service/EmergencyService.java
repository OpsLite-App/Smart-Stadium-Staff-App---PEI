package com.stadium.emergency_service.service;

import com.stadium.emergency_service.model.Incident;
import com.stadium.emergency_service.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmergencyService {

    private final IncidentRepository repository;

    public Incident createIncident(Incident incident) {
        return repository.save(incident);
    }

    public List<Incident> getActiveIncidents() {
        return repository.findByStatus("active");
    }

    public Incident assignResponder(Long incidentId, Integer userId) {
        Incident incident = repository.findById(incidentId)
                .orElseThrow(() -> new RuntimeException("Incident not found"));
        incident.setAssignedTo(userId);
        incident.setStatus("assigned");
        return repository.save(incident);
    }
}