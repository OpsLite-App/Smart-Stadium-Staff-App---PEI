import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'maintenance_tasks_provider.dart';

enum _TaskFilter { all, open, assigned, inProgress, completed }

class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  _TaskFilter _filter = _TaskFilter.all;

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(maintenanceTasksProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Chip(
                label: 'All',
                selected: _filter == _TaskFilter.all,
                onTap: () => setState(() => _filter = _TaskFilter.all),
              ),
              _Chip(
                label: 'Open',
                selected: _filter == _TaskFilter.open,
                onTap: () => setState(() => _filter = _TaskFilter.open),
              ),
              _Chip(
                label: 'Assigned',
                selected: _filter == _TaskFilter.assigned,
                onTap: () => setState(() => _filter = _TaskFilter.assigned),
              ),
              _Chip(
                label: 'In progress',
                selected: _filter == _TaskFilter.inProgress,
                onTap: () => setState(() => _filter = _TaskFilter.inProgress),
              ),
              _Chip(
                label: 'Completed',
                selected: _filter == _TaskFilter.completed,
                onTap: () => setState(() => _filter = _TaskFilter.completed),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Recarregar',
                onPressed: () => ref.read(maintenanceTasksProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: tasksAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, st) => _ErrorState(
              error: e.toString(),
              onRetry: () => ref.read(maintenanceTasksProvider.notifier).refresh(),
            ),
            data: (tasks) {
              final filtered = tasks.where((t) {
                if (_filter == _TaskFilter.all) return true;
                return switch (_filter) {
                  _TaskFilter.open => t.status == TaskStatus.open,
                  _TaskFilter.assigned => t.status == TaskStatus.assigned,
                  _TaskFilter.inProgress => t.status == TaskStatus.inProgress,
                  _TaskFilter.completed => t.status == TaskStatus.completed,
                  _ => true,
                };
              }).toList();

              // Ordenação simples: não-completed primeiro, depois por data
              filtered.sort((a, b) {
                final ra = _rankStatus(a.status);
                final rb = _rankStatus(b.status);
                if (ra != rb) return ra.compareTo(rb);

                final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
                final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
                return tb.compareTo(ta);
              });

              if (filtered.isEmpty) {
                return const Center(child: Text('Sem tasks para mostrar.'));
              }

              return ListView.separated(
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final t = filtered[i];
                  return ListTile(
                    leading: _StatusDot(status: t.status),
                    title: Text(
                      t.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      _subtitle(t),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: _TaskActions(task: t),
                    onTap: () => _openTaskBottomSheet(context, t),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }

  String _subtitle(MaintenanceTask t) {
    final loc = (t.locationText ?? t.locationNode ?? 'Local desconhecido').trim();
    final ass = (t.assignedTo ?? '').trim();
    if (ass.isEmpty) return loc;
    return '$loc · assigned: $ass';
  }

  int _rankStatus(TaskStatus s) {
    return switch (s) {
      TaskStatus.open => 1,
      TaskStatus.assigned => 2,
      TaskStatus.inProgress => 3,
      TaskStatus.completed => 4,
      TaskStatus.unknown => 5,
    };
  }

  void _openTaskBottomSheet(BuildContext context, MaintenanceTask t) {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(_subtitle(t)),
              const SizedBox(height: 10),
              if (t.description.trim().isNotEmpty) ...[
                Text(t.description),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  _StatusPill(status: t.status),
                  const SizedBox(width: 10),
                  if (t.locationNode != null)
                    Text('node: ${t.locationNode}', style: const TextStyle(color: Colors.black54)),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: (t.status == TaskStatus.open || t.status == TaskStatus.assigned)
                          ? () async {
                              Navigator.pop(context);
                              await ref.read(maintenanceTasksProvider.notifier).startTask(t.id);
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Task iniciada')),
                              );
                            }
                          : null,
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Start'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: (t.status == TaskStatus.inProgress || t.status == TaskStatus.assigned)
                          ? () async {
                              Navigator.pop(context);
                              await ref.read(maintenanceTasksProvider.notifier).completeTask(t.id);
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Task concluída')),
                              );
                            }
                          : null,
                      icon: const Icon(Icons.check),
                      label: const Text('Complete'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
            ],
          ),
        );
      },
    );
  }
}

class _TaskActions extends ConsumerWidget {
  const _TaskActions({required this.task});
  final MaintenanceTask task;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canStart = task.status == TaskStatus.open || task.status == TaskStatus.assigned;
    final canComplete = task.status == TaskStatus.inProgress || task.status == TaskStatus.assigned;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: 'Start',
          onPressed: canStart
              ? () async {
                  await ref.read(maintenanceTasksProvider.notifier).startTask(task.id);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Task iniciada')),
                  );
                }
              : null,
          icon: const Icon(Icons.play_arrow),
        ),
        IconButton(
          tooltip: 'Complete',
          onPressed: canComplete
              ? () async {
                  await ref.read(maintenanceTasksProvider.notifier).completeTask(task.id);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Task concluída')),
                  );
                }
              : null,
          icon: const Icon(Icons.check),
        ),
      ],
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.status});
  final TaskStatus status;

  @override
  Widget build(BuildContext context) {
    final icon = switch (status) {
      TaskStatus.open => Icons.radio_button_unchecked,
      TaskStatus.assigned => Icons.assignment_ind,
      TaskStatus.inProgress => Icons.timelapse,
      TaskStatus.completed => Icons.check_circle,
      TaskStatus.unknown => Icons.help_outline,
    };

    return CircleAvatar(child: Icon(icon));
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});
  final TaskStatus status;

  @override
  Widget build(BuildContext context) {
    final text = switch (status) {
      TaskStatus.open => 'OPEN',
      TaskStatus.assigned => 'ASSIGNED',
      TaskStatus.inProgress => 'IN PROGRESS',
      TaskStatus.completed => 'COMPLETED',
      TaskStatus.unknown => 'UNKNOWN',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.black12),
      ),
      child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
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

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Erro ao carregar tasks:\n$error', textAlign: TextAlign.center),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}
