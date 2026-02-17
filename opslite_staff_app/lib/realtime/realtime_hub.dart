import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

import '../domain/events/emergency_event.dart';
import '../domain/events/maintenance_event.dart';
import '../domain/events/crowd_event.dart';

class RealtimeHub {
  RealtimeHub({
    required String wsUrl,
    required String tokenProviderNameForDebug,
  })  : _wsUrl = wsUrl,
        _debugName = tokenProviderNameForDebug;

  final String _wsUrl;
  final String _debugName;

  StompClient? _client;
  bool _connected = false;

  bool get isConnected => _connected;

  final _emergencyController = StreamController<EmergencyEvent>.broadcast();
  final _maintenanceController = StreamController<MaintenanceEvent>.broadcast();
  final _crowdController = StreamController<CrowdEvent>.broadcast();

  Stream<EmergencyEvent> get emergency => _emergencyController.stream;
  Stream<MaintenanceEvent> get maintenance => _maintenanceController.stream;
  Stream<CrowdEvent> get crowd => _crowdController.stream;

  // ----------------------------------------------------------
  // CONNECT
  // ----------------------------------------------------------

  Future<void> connect({
    required String token,
    required String role,
  }) async {
    await disconnect();

    final headers = <String, String>{
      'Authorization': 'Bearer $token',
      'token': token,
    };

    _client = StompClient(
      config: StompConfig(
        url: _wsUrl,
        stompConnectHeaders: headers,
        webSocketConnectHeaders: headers,
        onConnect: (frame) {
          _connected = true;

          if (kDebugMode) {
            debugPrint('[$_debugName] WS connected');
          }

          _subscribeByRole(role);
        },
        onWebSocketError: (error) {
          _connected = false;
          if (kDebugMode) {
            debugPrint('[$_debugName] WS error: $error');
          }
        },
        onStompError: (frame) {
          _connected = false;
          if (kDebugMode) {
            debugPrint('[$_debugName] STOMP error: ${frame.body}');
          }
        },
        onDisconnect: (frame) {
          _connected = false;
          if (kDebugMode) {
            debugPrint('[$_debugName] WS disconnected');
          }
        },
        reconnectDelay: const Duration(seconds: 3),
      ),
    );

    _client!.activate();
  }

  Future<void> disconnect() async {
    try {
      _client?.deactivate();
    } catch (_) {}
    _client = null;
    _connected = false;
  }

  // ----------------------------------------------------------
  // SUBSCRIPTIONS
  // ----------------------------------------------------------

  void _subscribeByRole(String role) {
    if (_client == null) return;

    final r = role.toLowerCase();

    final canEmergency = r == 'admin' || r == 'supervisor' || r == 'security';
    final canMaintenance = r == 'admin' || r == 'supervisor' || r == 'cleaning';
    final canCrowd = r == 'admin' || r == 'supervisor' || r == 'security';

    if (canEmergency) {
      _client!.subscribe(
        destination: '/topic/emergency',
        callback: (frame) {
          final body = frame.body;
          if (body == null) return;

          final ev = EmergencyEvent.tryParse(body);
          if (ev != null) {
            _emergencyController.add(ev);
          }
        },
      );
    }

    if (canMaintenance) {
      _client!.subscribe(
        destination: '/topic/maintenance',
        callback: (frame) {
          final body = frame.body;
          if (body == null) return;

          final ev = MaintenanceEvent.tryParse(body);
          if (ev != null) {
            _maintenanceController.add(ev);
          }
        },
      );
    }

    if (canCrowd) {
      _client!.subscribe(
        destination: '/topic/crowd',
        callback: (frame) {
          final body = frame.body;
          if (body == null) return;

          final ev = CrowdEvent.tryParse(body);
          if (ev != null) {
            _crowdController.add(ev);
          }
        },
      );
    }

    // Eventos genéricos (opcional)
    _client!.subscribe(
      destination: '/topic/events',
      callback: (frame) {
        if (kDebugMode) {
          debugPrint('[$_debugName] Generic event: ${frame.body}');
        }
      },
    );
  }

  // ----------------------------------------------------------
  // DISPOSE
  // ----------------------------------------------------------

  void dispose() {
    disconnect();
    _emergencyController.close();
    _maintenanceController.close();
    _crowdController.close();
  }
}
