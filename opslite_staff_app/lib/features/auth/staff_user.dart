import 'role.dart';

class StaffUser {
  final int id;
  final String name;
  final String email;
  final Role role;

  StaffUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  factory StaffUser.fromJson(Map<String, dynamic> json) {
    return StaffUser(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      role: RoleX.fromString(json['role']), // 👈 AQUI
    );
  }
}
