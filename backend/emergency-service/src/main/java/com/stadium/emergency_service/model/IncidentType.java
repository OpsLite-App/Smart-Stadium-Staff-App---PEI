package com.stadium.emergency_service.model;

public enum IncidentType {
    FIRE("fire"),
    SMOKE("smoke"),
    GAS_LEAK("gas_leak"),
    STRUCTURAL("structural"),
    ELECTRICAL("electrical"),
    CHEMICAL("chemical"),
    BOMB_THREAT("bomb_threat"),
    OTHER("other");

    private final String value;

    IncidentType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static IncidentType fromString(String value) {
        for (IncidentType type : IncidentType.values()) {
            if (type.value.equalsIgnoreCase(value)) {
                return type;
            }
        }
        return OTHER;
    }
}
