package com.stadium.map_service.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stadium.map_service.dto.MapClosureDTO;
import com.stadium.map_service.dto.MapGraphDTO;
import com.stadium.map_service.dto.PythonMapResponseDTO;
import com.stadium.map_service.model.MapData;
import com.stadium.map_service.repository.MapRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Map Service that fetches data from Python Map-Service instead of local database
 * Maintains same API contract while delegating to Python backend
 */
@Service
public class MapService {

    private final MapRepository mapRepository;
    private final RestTemplate restTemplate;
    private final String pythonMapServiceUrl;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MapService(MapRepository mapRepository, 
                     RestTemplate restTemplate,
                     @Value("${app.map-service.url:http://localhost:8000}") String pythonMapServiceUrl) {
        this.mapRepository = mapRepository;
        this.restTemplate = restTemplate;
        this.pythonMapServiceUrl = pythonMapServiceUrl;
    }

    /**
     * Fetch map data from Python Map-Service
     * Falls back to database if Python service is unavailable
     */
    public MapGraphDTO getMapGraphDTO() {
        try {
            // Call Python service
            String url = pythonMapServiceUrl + "/api/map";
            PythonMapResponseDTO pythonResponse = restTemplate.getForObject(url, PythonMapResponseDTO.class);
            
            if (pythonResponse == null) {
                throw new RuntimeException("Empty response from Python Map-Service");
            }
            
            // Convert Python response to our MapGraphDTO format
            return convertPythonResponseToDTO(pythonResponse);
            
        } catch (Exception e) {
            // Fallback to database if Python service is unreachable
            System.err.println("Failed to fetch from Python service: " + e.getMessage());
            return getMapGraphDTOFromDatabase();
        }
    }

    /**
     * Fallback: Get map from local database (for resilience)
     */
    private MapGraphDTO getMapGraphDTOFromDatabase() {
        MapData map = mapRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Mapa não encontrado na base de dados"));
        return convertDatabaseToDTO(map);
    }

    @Transactional
    public MapGraphDTO updateClosures(MapClosureDTO closureDTO) {
        try {
            // Call Python service to update closures
            String url = pythonMapServiceUrl + "/api/closures";
            PythonMapResponseDTO pythonResponse = restTemplate.patchForObject(url, closureDTO, PythonMapResponseDTO.class);
            
            if (pythonResponse == null) {
                throw new RuntimeException("Empty response from Python Map-Service after update");
            }
            
            return convertPythonResponseToDTO(pythonResponse);
            
        } catch (Exception e) {
            // Fallback to database update
            System.err.println("Failed to update closures via Python service: " + e.getMessage());
            return updateClosuresInDatabase(closureDTO);
        }
    }

    /**
     * Fallback: Update closures in local database
     */
    private MapGraphDTO updateClosuresInDatabase(MapClosureDTO closureDTO) {
        MapData map = mapRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Mapa não encontrado"));
        try {
            String closuresJson = objectMapper.writeValueAsString(closureDTO.getClosures());
            map.setHazards(closuresJson);
            mapRepository.save(map);
            return convertDatabaseToDTO(map);
        } catch (Exception e) {
            throw new RuntimeException("Failed to update closures in database", e);
        }
    }

    /**
     * Convert Python service response to MapGraphDTO
     * Maps closures (Python) → hazards (Spring)
     */
    private MapGraphDTO convertPythonResponseToDTO(PythonMapResponseDTO pythonResponse) {
        MapGraphDTO dto = new MapGraphDTO();
        dto.setNodes(pythonResponse.getNodes() != null ? pythonResponse.getNodes() : Collections.emptyList());
        dto.setEdges(pythonResponse.getEdges() != null ? pythonResponse.getEdges() : Collections.emptyList());
        // Map closures from Python to hazards in our response
        dto.setHazards(pythonResponse.getClosures() != null ? pythonResponse.getClosures() : Collections.emptyList());
        return dto;
    }

    /**
     * Convert database MapData to MapGraphDTO (fallback/legacy)
     */
    private MapGraphDTO convertDatabaseToDTO(MapData mapData) {
        try {
            MapGraphDTO dto = new MapGraphDTO();
            dto.setNodes(parseJsonArray(mapData.getNodes()));
            dto.setEdges(parseJsonArray(mapData.getEdges()));
            dto.setHazards(parseJsonArray(mapData.getHazards()));
            return dto;
        } catch (Exception e) {
            throw new RuntimeException("Error converting MapData to DTO", e);
        }
    }

    /**
     * Legacy method: Convert database to DTO (kept for backward compatibility)
     */
    public MapGraphDTO convertToDTO(MapData mapData) {
        return convertDatabaseToDTO(mapData);
    }

    private List<Map<String, Object>> parseJsonArray(String json) {
        try {
            String trimmedJson = json.trim();
            
            if (trimmedJson.startsWith("[")) {
                return objectMapper.readValue(
                    trimmedJson, 
                    new TypeReference<List<Map<String, Object>>>() {}
                );
            } else if (trimmedJson.startsWith("{")) {
                Map<String, Object> map = objectMapper.readValue(
                    trimmedJson, 
                    new TypeReference<Map<String, Object>>() {}
                );
                return Collections.singletonList(map);
            } else {
                return Collections.emptyList();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse JSON from DB", e);
        }
    }
}
