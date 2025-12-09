package com.stadium.map_service.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stadium.map_service.dto.MapClosureDTO;
import com.stadium.map_service.dto.MapGraphDTO;
import com.stadium.map_service.model.MapData;
import com.stadium.map_service.repository.MapRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class MapService {

    private final MapRepository mapRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MapService(MapRepository mapRepository) {
        this.mapRepository = mapRepository;
    }

    public MapData getMapGraphEntity() {
        return mapRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Mapa não encontrado"));
    }

    public MapGraphDTO getMapGraphDTO() {
        MapData map = getMapGraphEntity();
        return convertToDTO(map);
    }

    @Transactional
    public MapGraphDTO updateClosures(MapClosureDTO closureDTO) {
        MapData map = getMapGraphEntity();
        try {
            // Replace hazards JSON with new closures
            String closuresJson = objectMapper.writeValueAsString(closureDTO.getClosures());
            map.setHazards(closuresJson);
            mapRepository.save(map);
            return convertToDTO(map);
        } catch (Exception e) {
            throw new RuntimeException("Failed to update closures", e);
        }
    }

    public MapGraphDTO convertToDTO(MapData mapData) {
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
