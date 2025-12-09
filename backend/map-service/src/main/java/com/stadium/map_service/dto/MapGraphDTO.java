package com.stadium.map_service.dto;

import java.util.Map;

import java.util.List;

public class MapGraphDTO {

    private List<Map<String, Object>> nodes;
    private List<Map<String, Object>> edges;
    private List<Map<String, Object>> hazards;

    public List<Map<String, Object>> getNodes() { return nodes; }
    public void setNodes(List<Map<String, Object>> nodes) { this.nodes = nodes; }

    public List<Map<String, Object>> getEdges() { return edges; }
    public void setEdges(List<Map<String, Object>> edges) { this.edges = edges; }

    public List<Map<String, Object>> getHazards() { return hazards; }
    public void setHazards(List<Map<String, Object>> hazards) { this.hazards = hazards; }
}
