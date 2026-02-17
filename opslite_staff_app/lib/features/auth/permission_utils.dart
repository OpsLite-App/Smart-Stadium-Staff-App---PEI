import 'role.dart';
import 'permissions.dart';

bool hasPermission(Role role, Permission p) {
  final key = role.name; // security/cleaning/medic/supervisor
  return rolePermissions[key]?.contains(p) ?? false;
}
