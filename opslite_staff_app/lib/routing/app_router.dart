import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/session.dart';
import '../features/auth/permissions.dart';
import '../features/auth/permission_utils.dart';

import '../features/auth/login_screen.dart';
import '../features/home/home_screen.dart';
import '../features/shell/app_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  bool isPublicRoute(String loc) => loc == '/login' || loc == '/settings';

  String? guardLoggedIn(GoRouterState state) {
    final session = ref.read(sessionProvider);
    final loc = state.matchedLocation;

    if (session == null && !isPublicRoute(loc)) return '/login';
    return null;
  }

  String? guardPermission(GoRouterState state, Permission p) {
    final session = ref.read(sessionProvider);
    final loc = state.matchedLocation;

    // 1) sem sessão -> login (exceto rotas públicas)
    if (session == null && !isPublicRoute(loc)) return '/login';

    // 2) com sessão -> verificar permissão
    final role = session?.role;
    if (role != null && !hasPermission(role, p)) {
      return '/app';
    }

    return null;
  }

  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),

      // app principal (tabs por role)
      GoRoute(
        path: '/app',
        redirect: (context, state) => guardLoggedIn(state),
        builder: (context, state) => const AppShell(),
      ),

      GoRoute(
        path: '/home',
        redirect: (context, state) => guardLoggedIn(state),
        builder: (_, __) => const HomeScreen(),
      ),

      // Rotas “feature” (por agora placeholders; depois ligamos aos ecrãs reais)
      GoRoute(
        path: '/alerts',
        redirect: (context, state) => guardPermission(state, Permission.viewAlerts),
        builder: (_, __) => const _PlaceholderScreen('Alertas'),
      ),
      GoRoute(
        path: '/tasks',
        redirect: (context, state) => guardPermission(state, Permission.viewTasks),
        builder: (_, __) => const _PlaceholderScreen('Tasks'),
      ),
      GoRoute(
        path: '/chat',
        redirect: (context, state) => guardPermission(state, Permission.viewChat),
        builder: (_, __) => const _PlaceholderScreen('Chat'),
      ),
      GoRoute(
        path: '/sos',
        redirect: (context, state) => guardPermission(state, Permission.viewSOS),
        builder: (_, __) => const _PlaceholderScreen('SOS'),
      ),
      GoRoute(
        path: '/analytics',
        redirect: (context, state) => guardPermission(state, Permission.viewAnalytics),
        builder: (_, __) => const _PlaceholderScreen('Analytics'),
      ),
      GoRoute(
        path: '/team',
        redirect: (context, state) => guardPermission(state, Permission.viewTeam),
        builder: (_, __) => const _PlaceholderScreen('Equipa'),
      ),
      GoRoute(
        path: '/profile',
        redirect: (context, state) => guardLoggedIn(state),
        builder: (_, __) => const _PlaceholderScreen('Perfil'),
      ),
    ],
  );
});

class _PlaceholderScreen extends StatelessWidget {
  const _PlaceholderScreen(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(child: Text(title)),
    );
  }
}
