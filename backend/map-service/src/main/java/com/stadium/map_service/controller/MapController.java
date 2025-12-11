package com.stadium.map_service.controller;

import com.stadium.map_service.dto.MapClosureDTO;
import com.stadium.map_service.dto.MapGraphDTO;
import com.stadium.map_service.services.MapService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/map")
public class MapController {

    private final MapService mapService;

    public MapController(MapService mapService) {
        this.mapService = mapService;
    }

    @GetMapping("/graph")
    public ResponseEntity<MapGraphDTO> getGraph() {
        return ResponseEntity.ok(mapService.getMapGraphDTO());
    }

    @PatchMapping("/closure")
    public ResponseEntity<MapGraphDTO> updateClosure(@RequestBody MapClosureDTO closureDTO) {
        return ResponseEntity.ok(mapService.updateClosures(closureDTO));
    }

    @GetMapping("/pois")
    public ResponseEntity<Object> getPOIs() {
        MapGraphDTO map = mapService.getMapGraphDTO();
        return ResponseEntity.ok(map.getNodes());
    }
}