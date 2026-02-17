import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/role.dart';
import '../auth/session.dart';
import '../map/map_items.dart';
import '../map/map_items_provider.dart';
import '../map/map_selection.dart';
import '../shell/tab_index_provider.dart';

enum _StatusFilter { all, open, assigned, resolved }

class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});

  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  _StatusFilter _filter = _StatusFilter.all;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final role = session?.role ?? Role.security;

    final items = ref.watch(mapItemsProvider);

    final visible = _filterItemsForRole(role, items);
    final filtered = visible.where((it) {
      if (_filter == _StatusFilter.all) return true;
      if (_filter == _StatusFilter.open) return it.status == 'open';
      if (_filter == _StatusFilter.assigned) return it.status == 'assigned';
      if (_filter == _StatusFilter.resolved) return it.status == 'resolved';
      return true;
    }).toList();

    filtered.sort((a, b) {
      final pa = _rankPriority(a.priority);
      final pb = _rankPriority(b.priority);
      if (pa != pb) return pb.compareTo(pa);

      final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
      final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
      return tb.compareTo(ta);
    });

    return Column(
      children: [
        // Filtros
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Chip(
                label: 'All (${visible.length})',
                selected: _filter == _StatusFilter.all,
                onTap: () => setState(() => _filter = _StatusFilter.all),
              ),
              _Chip(
                label: 'Open',
                selected: _filter == _StatusFilter.open,
                onTap: () => setState(() => _filter = _StatusFilter.open),
              ),
              _Chip(
                label: 'Assigned',
                selected: _filter == _StatusFilter.assigned,
                onTap: () => setState(() => _filter = _StatusFilter.assigned),
              ),
              _Chip(
                label: 'Resolved',
                selected: _filter == _StatusFilter.resolved,
                onTap: () => setState(() => _filter = _StatusFilter.resolved),
              ),
            ],
          ),
        ),

        const Divider(height: 1),

        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Text('Sem alertas para mostrar.'),
                )
              : ListView.separated(
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final it = filtered[i];
                    return ListTile(
                      leading: _leadingIcon(it),
                      title: Text(it.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(
                        it.subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: _PriorityPill(priority: it.priority),
                      onTap: () => _openOnMap(it),
                    );
                  },
                ),
        ),
      ],
    );
  }

  List<MapItem> _filterItemsForRole(Role role, List<MapItem> items) {
    switch (role) {
      case Role.security:
        // Security -> incidents + emergências
        return items.where((x) => x.type == MapItemType.incident).toList();

      case Role.cleaning:
        // Cleaning -> bins (e podes manter incidents se quiseres)
        return items.where((x) => x.type == MapItemType.bin).toList();

      case Role.medic:
        // Medic -> incidents (tipicamente médicos)
        return items.where((x) => x.type == MapItemType.incident).toList();

      case Role.supervisor:
        // Supervisor -> tudo
        return items;
    }
  }

  void _openOnMap(MapItem item) {
    // 1) seleciona item
    ref.read(selectedMapItemProvider.notifier).state = item;

    // 2) muda para tab "Mapa"
    ref.read(tabIndexProvider.notifier).state = 0;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Selecionado no mapa: ${item.title}'),
        duration: const Duration(milliseconds: 900),
      ),
    );
  }

  int _rankPriority(MapPriority p) {
    return switch (p) {
      MapPriority.low => 1,
      MapPriority.medium => 2,
      MapPriority.high => 3,
      MapPriority.critical => 4,
    };
  }

  Widget _leadingIcon(MapItem it) {
    final icon = it.type == MapItemType.incident
        ? Icons.warning_amber
        : Icons.delete_outline;

    return CircleAvatar(
      child: Icon(icon),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}

class _PriorityPill extends StatelessWidget {
  const _PriorityPill({required this.priority});

  final MapPriority priority;

  @override
  Widget build(BuildContext context) {
    final text = switch (priority) {
      MapPriority.low => 'LOW',
      MapPriority.medium => 'MED',
      MapPriority.high => 'HIGH',
      MapPriority.critical => 'CRIT',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.black12),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}
