package com.stadium.auth_service.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RoleAccessTest {

  @Test
  void medicalRoleUsesDedicatedMedicalIncidentsInsteadOfGenericTasks() {
    var permissions = RoleAccess.permissionsForRole("medical");

    assertFalse(permissions.get("canViewTasks"));
    assertTrue(permissions.get("canViewMedicalIncidents"));
  }

  @Test
  void securityAndCleaningKeepGenericTasksAccess() {
    assertTrue(RoleAccess.permissionsForRole("security").get("canViewTasks"));
    assertTrue(RoleAccess.permissionsForRole("cleaning").get("canViewTasks"));
  }
}
