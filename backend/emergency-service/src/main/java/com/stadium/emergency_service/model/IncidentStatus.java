package com.stadium.emergency_service.model;

public enum IncidentStatus {
    ACTIVE("active"),
    INVESTIGATING("investigating"),
    RESPONDING("responding"),
    CONTAINED("contained"),
    RESOLVED("resolved"),
    FALSE_ALARM("false_alarm");

    private final String value;

    IncidentStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static IncidentStatus fromString(String value) {
        for (IncidentStatus status : IncidentStatus.values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        return ACTIVE;
    }
}
