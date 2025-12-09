package com.stadium.map_service.dto;

import java.util.List;
import java.util.Map;

public class MapClosureDTO {

    private List<Map<String, Object>> closures; // [{"from":"N1","to":"N2","status":"closed"}]

    public List<Map<String, Object>> getClosures() { return closures; }
    public void setClosures(List<Map<String, Object>> closures) { this.closures = closures; }
}

