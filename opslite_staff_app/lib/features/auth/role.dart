enum Role {
  security,
  cleaning,
  medic,
  supervisor,
}

extension RoleX on Role {
  static Role fromString(String s) {
    switch (s.trim().toLowerCase()) {
      case 'security':
        return Role.security;
      case 'cleaning':
        return Role.cleaning;
      case 'medic':
        return Role.medic;
      case 'supervisor':
        return Role.supervisor;
      default:
        return Role.security; // fallback seguro
    }
  }

  String get label {
    switch (this) {
      case Role.security:
        return 'Security';
      case Role.cleaning:
        return 'Cleaning';
      case Role.medic:
        return 'Medic';
      case Role.supervisor:
        return 'Supervisor';
    }
  }
}
