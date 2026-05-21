package com.stadium.auth_service.security;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class RoleAccess {
  private RoleAccess() {}

  public static final Set<String> VALID_ROLES = Set.of("Security", "Cleaning", "Supervisor", "Medical");

  public static String normalizeRole(String role) {
    String value = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
    if (value.equals("cleaning") || value.equals("cleaner") || value.equals("maintenance")) return "Cleaning";
    if (value.equals("supervisor") || value.equals("admin")) return "Supervisor";
    if (value.equals("medical") || value.equals("medic") || value.equals("doctor")) return "Medical";
    return "Security";
  }

  public static Map<String, Boolean> permissionsForRole(String role) {
    String normalized = normalizeRole(role);
    Map<String, Boolean> permissions = new LinkedHashMap<>();

    boolean supervisor = normalized.equals("Supervisor");
    boolean security = normalized.equals("Security");
    boolean cleaning = normalized.equals("Cleaning");
    boolean medical = normalized.equals("Medical");

    permissions.put("canViewDashboard", true);
    permissions.put("canViewMap", true);
    permissions.put("canUseNavigation", true);
    permissions.put("canViewAlerts", true);
    permissions.put("canUseChat", !supervisor);
    permissions.put("canUseEmergencyButton", security);
    permissions.put("canViewTasks", true);
    permissions.put("canViewMedicalIncidents", medical);
    permissions.put("canViewAnalytics", supervisor);
    permissions.put("canViewTeam", supervisor);
    permissions.put("canViewHeatmap", security || supervisor || medical);
    permissions.put("canViewBins", cleaning || supervisor);
    permissions.put("canAcknowledgeAlerts", security || supervisor);
    permissions.put("canCreateIncidents", supervisor);
    permissions.put("canManageIncidents", supervisor);
    permissions.put("canDispatchIncidents", supervisor);
    permissions.put("canResolveIncidents", supervisor || medical);
    permissions.put("canManageCameraDensity", supervisor);

    return permissions;
  }
}
