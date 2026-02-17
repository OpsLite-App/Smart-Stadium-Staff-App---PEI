import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../shell/tab_index_provider.dart';
import 'selected_staff_provider.dart';
import 'staff_provider.dart';

class TeamScreen extends ConsumerWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staffAsync = ref.watch(staffListProvider);

    return staffAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, st) => _ErrorState(
        error: e.toString(),
        onRetry: () => ref.read(staffListProvider.notifier).refresh(),
      ),
      data: (staff) {
        if (staff.isEmpty) {
          return const Center(child: Text('Sem staff disponível.'));
        }

        staff.sort((a, b) => a.role.compareTo(b.role));

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: Row(
                children: [
                  Text(
                    'Equipa (${staff.length})',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Recarregar',
                    onPressed: () => ref.read(staffListProvider.notifier).refresh(),
                    icon: const Icon(Icons.refresh),
                  )
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.separated(
                itemCount: staff.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final s = staff[i];
                  return ListTile(
                    leading: CircleAvatar(child: Icon(_iconForRole(s.role))),
                    title: Text(s.name),
                    subtitle: Text(_subtitle(s)),
                    trailing: s.available == null
                        ? null
                        : _AvailabilityPill(available: s.available!),
                    onTap: () {
                      ref.read(selectedStaffProvider.notifier).state = s;

                      ref.read(tabIndexProvider.notifier).state = 0;

                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('A focar no mapa: ${s.name}'),
                          duration: const Duration(milliseconds: 900),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  String _subtitle(StaffMember s) {
    final loc = (s.location ?? 'localização desconhecida').trim();
    return '${s.role} · $loc';
  }

  IconData _iconForRole(String role) {
    final r = role.toLowerCase();
    if (r.contains('security')) return Icons.shield;
    if (r.contains('clean')) return Icons.cleaning_services;
    if (r.contains('medic')) return Icons.medical_services;
    if (r.contains('super')) return Icons.supervisor_account;
    return Icons.person_pin_circle;
  }
}

class _AvailabilityPill extends StatelessWidget {
  const _AvailabilityPill({required this.available});
  final bool available;

  @override
  Widget build(BuildContext context) {
    final text = available ? 'AVAILABLE' : 'BUSY';
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
            Text('Erro ao carregar equipa:\n$error', textAlign: TextAlign.center),
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
