package com.stadium.emergency_service.model;

public enum IncidentSeverity {
    LOW("low"),
    MEDIUM("medium"),
    HIGH("high"),
    CRITICAL("critical");

    private final String value;

    IncidentSeverity(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static IncidentSeverity fromString(String value) {
        for (IncidentSeverity severity : IncidentSeverity.values()) {
            if (severity.value.equalsIgnoreCase(value)) {
                return severity;
            }
        }
        return MEDIUM;
    }
}
