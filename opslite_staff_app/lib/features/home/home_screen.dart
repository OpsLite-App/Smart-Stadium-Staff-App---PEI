import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../realtime/realtime_providers.dart';
import '../../realtime/event_feed_list.dart';
import '../../realtime/event_feed_provider.dart';
import '../../realtime/event_stats_providers.dart';
import '../../realtime/emergency_state_provider.dart';
import '../../realtime/emergency_snackbar_provider.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // watchers globais (não produzem UI)
    ref.listen(emergencyWatcherProvider, (_, __) {});
    ref.listen(emergencySnackbarProvider, (_, __) {});

    // streams (último evento)
    final crowd = ref.watch(crowdStreamProvider);
    final maint = ref.watch(maintenanceStreamProvider);
    final emerg = ref.watch(emergencyStreamProvider);

    // estatísticas derivadas
    final crowdCount = ref.watch(crowdCountProvider);
    final maintCount = ref.watch(maintenanceCountProvider);
    final emergActive = ref.watch(emergencyActiveProvider);
    final emergActiveCount = ref.watch(emergencyActiveCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            tooltip: 'Limpar feed',
            icon: const Icon(Icons.delete_sweep),
            onPressed: () {
              ref.read(eventFeedProvider.notifier).clear();
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (emergActive)
            Card(
              color: Colors.redAccent.withOpacity(0.08),
              child: ListTile(
                leading: const Icon(Icons.warning_amber, color: Colors.red),
                title: const Text(
                  'EMERGÊNCIA ATIVA',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: const Text('Existe pelo menos um SOS ativo.'),
                trailing: Text('Total: $emergActiveCount'),
              ),
            ),
          if (emergActive) const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text('Crowd: $crowdCount')),
              Chip(label: Text('Maintenance: $maintCount')),
              Chip(label: Text('Emergency: $emergActiveCount')),
            ],
          ),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              title: const Text('Crowd'),
              subtitle: crowd.when(
                data: (e) =>
                    Text('Gate ${e.gate} | ${e.level} | people=${e.people}'),
                loading: () => const Text('A aguardar eventos...'),
                error: (err, _) => Text('Erro: $err'),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: const Text('Maintenance'),
              subtitle: maint.when(
                data: (e) => Text('Bin ${e.binId} | ${e.status}'),
                loading: () => const Text('A aguardar eventos...'),
                error: (err, _) => Text('Erro: $err'),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: const Text('Emergency'),
              subtitle: emerg.when(
                data: (e) => Text('SOS ${e.id} | ${e.kind} | ${e.status}'),
                loading: () => const Text('A aguardar eventos...'),
                error: (err, _) => Text('Erro: $err'),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'Últimos eventos',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const EventFeedList(),
        ],
      ),
    );
  }
}
