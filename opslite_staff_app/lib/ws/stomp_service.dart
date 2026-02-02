import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

import '../storage/settings_store.dart';

class StompService {
  StompService(this._wsUrl);

  final String _wsUrl;
  StompClient? _client;

  final _connectionController = StreamController<bool>.broadcast();
  Stream<bool> get connectionStream => _connectionController.stream;

  bool get isConnected => _client?.connected ?? false;

  Future<void> connect({Map<String, String>? headers}) async {
    // Se já existe, desconecta primeiro
    await disconnect();
    if (_wsUrl.isEmpty) {
      throw StateError('WS url is empty (Settings not loaded yet)');
    }

    final completer = Completer<void>();

    _client = StompClient(
      config: StompConfig(
        url: _wsUrl,
        stompConnectHeaders: headers ?? const {},
        webSocketConnectHeaders: headers ?? const {},
        onConnect: (frame) {
          _connectionController.add(true);
          if (!completer.isCompleted) completer.complete();
        },
        onWebSocketError: (dynamic err) {
          _connectionController.add(false);
          if (!completer.isCompleted) {
            completer.completeError(err);
          }
        },
        onStompError: (frame) {
          _connectionController.add(false);
          if (!completer.isCompleted) {
            completer.completeError(frame.body ?? 'stomp error');
          }
        },
        onDisconnect: (_) {
          _connectionController.add(false);
        },
        reconnectDelay: const Duration(seconds: 0), // sem auto aqui; fazemos manual no passo 3
      ),
    );

    _client!.activate();

    return completer.future.timeout(
      const Duration(seconds: 5),
      onTimeout: () {
        throw TimeoutException('WS connect timeout');
      },
    );
  }

  Future<void> disconnect() async {
    final c = _client;
    _client = null;
    if (c != null) {
      c.deactivate();
    }
    _connectionController.add(false);
  }

  void dispose() {
    _connectionController.close();
    disconnect();
  }
}

final stompServiceProvider = Provider<StompService>((ref) {
  final settingsAsync = ref.watch(settingsStoreProvider);

  final wsUrl = settingsAsync.maybeWhen(
    data: (s) => s.wsUrl,
    orElse: () => '',
  );

  final service = StompService(wsUrl);
  ref.onDispose(service.dispose);
  return service;
});
