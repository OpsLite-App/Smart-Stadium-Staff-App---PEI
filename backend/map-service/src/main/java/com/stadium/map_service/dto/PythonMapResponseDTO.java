package com.stadium.map_service.dto;

import java.util.List;
import java.util.Map;

/**
 * DTO representing response from Python Map-Service
 * Mirrors the Python API response structure
 */
public class PythonMapResponseDTO {
    private List<Map<String, Object>> nodes;
    private List<Map<String, Object>> edges;
    private List<Map<String, Object>> closures;

    public List<Map<String, Object>> getNodes() {
        return nodes;
    }

    public void setNodes(List<Map<String, Object>> nodes) {
        this.nodes = nodes;
    }

    public List<Map<String, Object>> getEdges() {
        return edges;
    }

    public void setEdges(List<Map<String, Object>> edges) {
        this.edges = edges;
    }

    public List<Map<String, Object>> getClosures() {
        return closures;
    }

    public void setClosures(List<Map<String, Object>> closures) {
        this.closures = closures;
    }
}
