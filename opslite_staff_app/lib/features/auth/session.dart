import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'role.dart';

class SessionState {
  const SessionState({
    required this.userId,
    required this.username,
    required this.role,
    required this.token,
  });

  final int userId;
  final String username;
  final Role role;
  final String token;

  SessionState copyWith({
    int? userId,
    String? username,
    Role? role,
    String? token,
  }) {
    return SessionState(
      userId: userId ?? this.userId,
      username: username ?? this.username,
      role: role ?? this.role,
      token: token ?? this.token,
    );
  }
}

class SessionController extends Notifier<SessionState?> {
  @override
  SessionState? build() => null;

  void login(SessionState session) => state = session;

  void logout() => state = null;
}

final sessionProvider =
    NotifierProvider<SessionController, SessionState?>(SessionController.new);

final currentRoleProvider = Provider<Role?>((ref) {
  return ref.watch(sessionProvider)?.role;
});

final isLoggedInProvider = Provider<bool>((ref) {
  return ref.watch(sessionProvider) != null;
});

final currentUsernameProvider = Provider<String?>((ref) {
  return ref.watch(sessionProvider)?.username;
});

final currentTokenProvider = Provider<String?>((ref) {
  return ref.watch(sessionProvider)?.token;
});
