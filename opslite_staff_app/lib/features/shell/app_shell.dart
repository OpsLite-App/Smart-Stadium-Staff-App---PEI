import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/role.dart';
import '../auth/session.dart';
import '../../ws/ws_connection_controller.dart';
import '../map/map_screen.dart';
import '../alerts/alerts_screen.dart';
import '../tasks/tasks_screen.dart';
import '../team/team_screen.dart';
import 'tab_index_provider.dart';
import '../sos/sos_screen.dart';
import '../chat/chat_screen.dart';
import '../profile/profile_screen.dart';



class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(wsConnectionControllerProvider);

    final session = ref.watch(sessionProvider);
    final role = session?.role;

    if (role == null) {
      return const Scaffold(
        body: Center(child: Text('Sem sessão. Volta ao login.')),
      );
    }

    final destinations = _destinationsFor(role);
    final pages = _pagesFor(role);

    final currentIndex = ref.watch(tabIndexProvider);

    final safeIndex = currentIndex.clamp(0, pages.length - 1);
    if (safeIndex != currentIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ref.read(tabIndexProvider.notifier).state = safeIndex;
      });
    }


    final media = MediaQuery.of(context);
    final isLandscape = media.orientation == Orientation.landscape;
    final isWide = media.size.width >= 720;
    final useRail = isLandscape || isWide;

    final title = _titleFor(role, currentIndex.clamp(0, pages.length - 1));

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: 'Logout',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(sessionProvider.notifier).logout(),
          ),
        ],
      ),
      body: useRail
          ? Row(
              children: [
                NavigationRail(
                  selectedIndex: currentIndex.clamp(0, pages.length - 1),
                  onDestinationSelected: (i) =>
                      ref.read(tabIndexProvider.notifier).state = i,
                  labelType: NavigationRailLabelType.all,
                  extended: isWide,
                  destinations: destinations
                      .map(
                        (d) => NavigationRailDestination(
                          icon: Icon(d.icon),
                          selectedIcon: Icon(d.selectedIcon ?? d.icon),
                          label: Text(d.label),
                        ),
                      )
                      .toList(),
                ),
                const VerticalDivider(width: 1),
                Expanded(
                  child: IndexedStack(
                    index: currentIndex.clamp(0, pages.length - 1),
                    children: pages,
                  ),
                ),
              ],
            )
          : IndexedStack(
              index: currentIndex.clamp(0, pages.length - 1),
              children: pages,
            ),
      bottomNavigationBar: useRail
          ? null
          : BottomNavigationBar(
              currentIndex: currentIndex.clamp(0, pages.length - 1),
              type: BottomNavigationBarType.fixed,
              onTap: (i) => ref.read(tabIndexProvider.notifier).state = i,
              items: destinations
                  .map(
                    (d) => BottomNavigationBarItem(
                      icon: Icon(d.icon),
                      label: d.label,
                    ),
                  )
                  .toList(),
            ),
    );
  }

  List<_NavItem> _destinationsFor(Role role) {
    switch (role) {
      case Role.security:
        return const [
          _NavItem(label: 'Mapa', icon: Icons.map),
          _NavItem(label: 'Alertas', icon: Icons.notifications),
          _NavItem(label: 'Chat', icon: Icons.chat),
          _NavItem(label: 'SOS', icon: Icons.warning_amber),
          _NavItem(label: 'Perfil', icon: Icons.person),
        ];
      case Role.cleaning:
        return const [
          _NavItem(label: 'Mapa', icon: Icons.map),
          _NavItem(label: 'Alertas', icon: Icons.notifications),
          _NavItem(label: 'Tasks', icon: Icons.task_alt),
          _NavItem(label: 'Chat', icon: Icons.chat),
          _NavItem(label: 'Perfil', icon: Icons.person),
        ];
      case Role.medic:
        return const [
          _NavItem(label: 'Mapa', icon: Icons.map),
          _NavItem(label: 'SOS', icon: Icons.warning_amber),
          _NavItem(label: 'Chat', icon: Icons.chat),
          _NavItem(label: 'Perfil', icon: Icons.person),
        ];
      case Role.supervisor:
        return const [
          _NavItem(label: 'Mapa', icon: Icons.map),
          _NavItem(label: 'Alertas', icon: Icons.notifications),
          _NavItem(label: 'Analytics', icon: Icons.query_stats),
          _NavItem(label: 'Equipa', icon: Icons.groups),
          _NavItem(label: 'Perfil', icon: Icons.person),
        ];
    }
  }

  List<Widget> _pagesFor(Role role) {
    switch (role) {
      case Role.security:
        return const [
          MapScreen(),
          AlertsScreen(),
          ChatScreen(),
          SosScreen(),
          ProfileScreen(),
        ];
      case Role.cleaning:
        return const [
          MapScreen(),
          AlertsScreen(),
          TasksScreen(),
          ChatScreen(),
          ProfileScreen(),
        ];
      case Role.medic:
        return const [
          MapScreen(),
          SosScreen(),
          ChatScreen(),
          ProfileScreen(),

        ];
      case Role.supervisor:
        return const [
          MapScreen(),
          AlertsScreen(),
          _PlaceholderPage(title: 'Analytics'),
          TeamScreen(),
          ProfileScreen(),
        ];
    }
  }

  String _titleFor(Role role, int index) {
    final labels = _destinationsFor(role).map((e) => e.label).toList();
    if (index < 0 || index >= labels.length) return 'OpsLite';
    return labels[index];
  }
}

class _NavItem {
  final String label;
  final IconData icon;
  final IconData? selectedIcon;

  const _NavItem({
    required this.label,
    required this.icon,
    this.selectedIcon,
  });
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        title,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
      ),
    );
  }
}
