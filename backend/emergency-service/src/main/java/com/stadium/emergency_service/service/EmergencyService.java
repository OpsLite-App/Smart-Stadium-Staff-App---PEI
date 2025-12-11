package com.stadium.emergency_service.service;

import com.stadium.emergency_service.dto.CreateIncidentDTO;
import com.stadium.emergency_service.dto.IncidentResponseDTO;
import com.stadium.emergency_service.dto.AssignIncidentDTO;
import com.stadium.emergency_service.model.Incident;
import com.stadium.emergency_service.remote.*;
import com.stadium.emergency_service.repository.IncidentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmergencyService {

    private final RestTemplate restTemplate;
    private final IncidentRepository repository;

    @Value("${python.service.url:http://localhost:8007}")
    private String pythonServiceUrl;

    // Create incident by forwarding to Python service
    public IncidentResponseDTO createIncident(CreateIncidentDTO dto) {
        // Build full payload expected by Python service
        IncidentCreatePayload payload = new IncidentCreatePayload();
        payload.setIncident_type(dto.getIncidentType());
        payload.setLocation_node(dto.getLocationNode());
        payload.setLocation(dto.getLocationNode()); // Legacy support
        payload.setSeverity(dto.getSeverity());
        payload.setDescription(dto.getDescription());
        payload.setLocation_description(dto.getLocationDescription());
        payload.setAffected_area(dto.getAffectedArea());
        payload.setDetected_by(dto.getDetectedBy());
        payload.setSensor_id(dto.getSensorId());
        payload.setReported_by(dto.getReportedBy());
        payload.setIncident_metadata(dto.getIncidentMetadata());

        String url = pythonServiceUrl + "/api/emergency/incidents?auto_dispatch=true";

        try {
            ResponseEntity<IncidentResponseRemote> resp =
                    restTemplate.postForEntity(url, payload, IncidentResponseRemote.class);

            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                IncidentResponseRemote remote = resp.getBody();

                // Persist locally for cache/fallback purposes
                Incident local = new Incident();
                local.setId(remote.getId());
                local.setIncidentType(remote.getIncident_type());
                local.setLocationNode(remote.getLocation_node());
                local.setLocation(remote.getLocation());
                local.setSeverity(remote.getSeverity());
                local.setStatus(remote.getStatus());
                local.setAssignedTo(remote.getAssigned_to());
                local.setDescription(remote.getDescription());
                local.setLocationDescription(remote.getLocation_description());
                local.setAffectedArea(remote.getAffected_area());
                local.setDetectedBy(remote.getDetected_by());
                local.setSensorId(remote.getSensor_id());
                local.setReportedBy(remote.getReported_by());
                local.setEvacuationTriggered(remote.getEvacuation_triggered());
                local.setRespondersDispatched(remote.getResponders_dispatched());
                local.setIncidentMetadata(remote.getIncident_metadata());
                repository.save(local);

                // Trigger evacuation if critical fire
                if ("fire".equals(remote.getIncident_type()) && 
                    "critical".equals(remote.getSeverity())) {
                    triggerEvacuation(remote.getId(), remote.getLocation_node(), remote.getAffected_area());
                }

                return mapRemoteToDto(remote);
            } else {
                throw new RestClientException("Failed to create incident on Python service: " + resp.getStatusCode());
            }
        } catch (RestClientException e) {
            // fallback: persist in local DB and return
            Incident localIncident = new Incident();
            localIncident.setIncidentType(dto.getIncidentType());
            localIncident.setLocationNode(dto.getLocationNode());
            localIncident.setLocation(dto.getLocationNode());
            localIncident.setSeverity(dto.getSeverity());
            localIncident.setStatus("active");
            localIncident.setDescription(dto.getDescription());
            localIncident.setLocationDescription(dto.getLocationDescription());
            localIncident.setAffectedArea(dto.getAffectedArea());
            localIncident.setDetectedBy(dto.getDetectedBy());
            localIncident.setSensorId(dto.getSensorId());
            localIncident.setReportedBy(dto.getReportedBy());
            localIncident.setIncidentMetadata(dto.getIncidentMetadata());
            
            // Generate temporary ID if Python service is down
            localIncident.setId("inc-" + java.util.UUID.randomUUID().toString().substring(0, 8));
            
            Incident saved = repository.save(localIncident);
            return mapLocalToDto(saved);
        }
    }

    // List active incidents by proxying to Python (preferred) otherwise fallback to repo
    public List<IncidentResponseDTO> getActiveIncidents() {
        String url = pythonServiceUrl + "/api/emergency/incidents?status=active&limit=200";

        try {
            ResponseEntity<RemoteActiveIncidentsWrapper> resp =
                    restTemplate.getForEntity(url, RemoteActiveIncidentsWrapper.class);

            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                List<IncidentResponseRemote> remoteList = resp.getBody().getIncidents();
                return remoteList.stream()
                        .map(this::mapRemoteToDto)
                        .collect(Collectors.toList());
            }
        } catch (RestClientException ignored) {
            // ignore and fallback to DB
        }

        // fallback local
        return repository.findByStatus("active")
                .stream()
                .map(this::mapLocalToDto)
                .collect(Collectors.toList());
    }

    // Assign responder: we translate your assign request into a dispatch request to Python.
    // Since Python's dispatch returns dispatch records, we fetch updated incident afterwards.
    public IncidentResponseDTO assignResponder(String incidentId, Integer userId) {
        String dispatchUrl = pythonServiceUrl + "/api/emergency/dispatch";

        // We request 1 responder — role is left generic here. You can adapt to role mapping.
        DispatchRequest req = new DispatchRequest();
        req.setIncident_id(incidentId);
        req.setResponder_role("any");
        req.setNum_responders(1);

        try {
            ResponseEntity<DispatchResponse[]> dispatchResp =
                    restTemplate.postForEntity(dispatchUrl, req, DispatchResponse[].class);

            if (!dispatchResp.getStatusCode().is2xxSuccessful()) {
                throw new RestClientException("Dispatch failed: " + dispatchResp.getStatusCode());
            }

            // After dispatch, get the incident from Python to return updated state
            String incidentUrl = pythonServiceUrl + "/api/emergency/incidents/" + incidentId;
            ResponseEntity<IncidentResponseRemote> incidentResp =
                    restTemplate.getForEntity(incidentUrl, IncidentResponseRemote.class);

            if (incidentResp.getStatusCode().is2xxSuccessful() && incidentResp.getBody() != null) {
                IncidentResponseRemote remote = incidentResp.getBody();
                
                // Trigger evacuation if critical fire
                if ("fire".equals(remote.getIncident_type()) && 
                    "critical".equals(remote.getSeverity())) {
                    triggerEvacuation(remote.getId(), remote.getLocation_node(), remote.getAffected_area());
                }
                
                // update local DB for compatibility
                repository.findById(remote.getId()).ifPresentOrElse(existing -> {
                    existing.setStatus(remote.getStatus());
                    existing.setAssignedTo(remote.getAssigned_to());
                    existing.setEvacuationTriggered(remote.getEvacuation_triggered());
                    existing.setRespondersDispatched(remote.getResponders_dispatched());
                    repository.save(existing);
                }, () -> {
                    Incident newLocal = new Incident();
                    newLocal.setId(remote.getId());
                    newLocal.setIncidentType(remote.getIncident_type());
                    newLocal.setLocationNode(remote.getLocation_node());
                    newLocal.setLocation(remote.getLocation());
                    newLocal.setSeverity(remote.getSeverity());
                    newLocal.setStatus(remote.getStatus());
                    newLocal.setAssignedTo(remote.getAssigned_to());
                    newLocal.setEvacuationTriggered(remote.getEvacuation_triggered());
                    newLocal.setRespondersDispatched(remote.getResponders_dispatched());
                    repository.save(newLocal);
                });

                return mapRemoteToDto(remote);
            } else {
                throw new RestClientException("Could not fetch incident after dispatch");
            }
        } catch (RestClientException e) {
            // As a last resort, fallback to local assignment (keeps existing behaviour)
            Incident incident = repository.findById(incidentId)
                    .orElseThrow(() -> new RuntimeException("Incident not found"));
            incident.setAssignedTo(userId);
            incident.setStatus("assigned");
            Incident updated = repository.save(incident);
            return mapLocalToDto(updated);
        }
    }

    // Trigger evacuation for critical incidents
    private void triggerEvacuation(String incidentId, String locationNode, String affectedArea) {
        try {
            String evacuationUrl = pythonServiceUrl + "/api/emergency/evacuation";
            
            Map<String, Object> evacuationReq = new java.util.HashMap<>();
            evacuationReq.put("incident_id", incidentId);
            evacuationReq.put("affected_zones", affectedArea != null ? 
                java.util.Arrays.asList(affectedArea) : java.util.Arrays.asList(locationNode));
            evacuationReq.put("evacuation_type", "partial");
            evacuationReq.put("reason", "Critical fire incident detected");
            
            restTemplate.postForEntity(evacuationUrl, evacuationReq, Map.class);
            System.out.println("✅ Evacuation triggered for incident " + incidentId);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to trigger evacuation: " + e.getMessage());
            // Don't fail the incident assignment if evacuation fails
        }
    }

    // Mappers
    private IncidentResponseDTO mapRemoteToDto(IncidentResponseRemote r) {
        IncidentResponseDTO dto = new IncidentResponseDTO();
        dto.setId(r.getId());
        dto.setIncidentType(r.getIncident_type());
        dto.setLocationNode(r.getLocation_node());
        dto.setLocation(r.getLocation());
        dto.setSeverity(r.getSeverity());
        dto.setStatus(r.getStatus());
        dto.setAssignedTo(r.getAssigned_to());
        dto.setDescription(r.getDescription());
        dto.setLocationDescription(r.getLocation_description());
        dto.setAffectedArea(r.getAffected_area());
        dto.setDetectedBy(r.getDetected_by());
        dto.setSensorId(r.getSensor_id());
        dto.setReportedBy(r.getReported_by());
        dto.setEvacuationTriggered(r.getEvacuation_triggered());
        dto.setRespondersDispatched(r.getResponders_dispatched());
        dto.setIncidentMetadata(r.getIncident_metadata());
        dto.setCreatedAt(r.getCreated_at());
        dto.setUpdatedAt(r.getUpdated_at());
        dto.setDetectedAt(r.getDetected_at());
        return dto;
    }

    private IncidentResponseDTO mapLocalToDto(Incident incident) {
        IncidentResponseDTO dto = new IncidentResponseDTO();
        dto.setId(incident.getId());
        dto.setIncidentType(incident.getIncidentType());
        dto.setLocationNode(incident.getLocationNode());
        dto.setLocation(incident.getLocation());
        dto.setSeverity(incident.getSeverity());
        dto.setStatus(incident.getStatus());
        dto.setAssignedTo(incident.getAssignedTo());
        dto.setDescription(incident.getDescription());
        dto.setLocationDescription(incident.getLocationDescription());
        dto.setAffectedArea(incident.getAffectedArea());
        dto.setDetectedBy(incident.getDetectedBy());
        dto.setSensorId(incident.getSensorId());
        dto.setReportedBy(incident.getReportedBy());
        dto.setEvacuationTriggered(incident.getEvacuationTriggered());
        dto.setRespondersDispatched(incident.getRespondersDispatched());
        dto.setIncidentMetadata(incident.getIncidentMetadata());
        dto.setCreatedAt(incident.getCreatedAt());
        dto.setUpdatedAt(incident.getUpdatedAt());
        dto.setDetectedAt(incident.getDetectedAt());
        return dto;
    }

    // wrapper class because Python /api/emergency/incidents returns a structure:
    // { total, active_count, incidents: [...] }
    private static class RemoteActiveIncidentsWrapper {
        private Integer total;
        private Integer active_count;
        private List<IncidentResponseRemote> incidents;

        public List<IncidentResponseRemote> getIncidents() { return incidents; }
        public void setIncidents(List<IncidentResponseRemote> incidents) { this.incidents = incidents; }
    }
}