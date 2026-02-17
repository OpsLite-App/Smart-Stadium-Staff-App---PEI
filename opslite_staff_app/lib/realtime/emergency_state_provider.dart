import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/events/emergency_event.dart';
import 'realtime_providers.dart';

final activeSosIdsProvider = StateProvider<Set<String>>((ref) => <String>{});

final emergencyActiveProvider = Provider<bool>((ref) {
  return ref.watch(activeSosIdsProvider).isNotEmpty;
});

final emergencyActiveCountProvider = Provider<int>((ref) {
  return ref.watch(activeSosIdsProvider).length;
});

bool _isActiveStatus(String status) {
  final s = status.trim().toLowerCase();

  return s == 'open' || s == 'active' || s == 'investigating' || s == 'responding';
}

bool _isClosedStatus(String status) {
  final s = status.trim().toLowerCase();
  return s == 'closed' || s == 'resolved' || s == 'completed' || s == 'done';
}

final emergencyWatcherProvider = Provider<void>((ref) {
  ref.listen<AsyncValue<EmergencyEvent>>(emergencyStreamProvider, (prev, next) {
    final e = next.valueOrNull;
    if (e == null) return;

    final id = e.id.trim();
    if (id.isEmpty) return;

    final current = ref.read(activeSosIdsProvider);
    final set = {...current}; // copia

    if (_isActiveStatus(e.status)) {
      set.add(id);
    } else if (_isClosedStatus(e.status)) {
      set.remove(id);
    }

    ref.read(activeSosIdsProvider.notifier).state = set;
  });
});
