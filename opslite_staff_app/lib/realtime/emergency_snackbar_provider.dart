import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/events/emergency_event.dart';
import 'realtime_providers.dart';

final scaffoldMessengerKeyProvider = Provider<GlobalKey<ScaffoldMessengerState>>((ref) {
  return GlobalKey<ScaffoldMessengerState>();
});

final emergencySnackbarProvider = Provider<void>((ref) {
  final messengerKey = ref.watch(scaffoldMessengerKeyProvider);

  final notified = HashSet<String>();

  ref.listen<AsyncValue<EmergencyEvent>>(emergencyStreamProvider, (prev, next) {
    final event = next.valueOrNull;
    if (event == null) return;

    final id = event.id.trim();
    if (id.isEmpty) return;

    final status = event.status.trim().toLowerCase();

    final isActive = status == 'open' || status == 'active';

    if (!isActive) return;

    if (notified.contains(id)) return;
    notified.add(id);

    final messenger = messengerKey.currentState;
    if (messenger == null) return;

    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 4),
        content: Text('🚨 Emergência: ${event.kind} (ID: $id)'),
        action: SnackBarAction(
          label: 'Ver',
          onPressed: () {
          },
        ),
      ),
    );
  });
});
