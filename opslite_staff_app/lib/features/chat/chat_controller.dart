import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

import '../../storage/settings_store.dart';
import '../auth/session.dart';
import '../../network/service_base_urls.dart';
import '../../domain/chat/chat_message.dart';

final chatControllerProvider =
    NotifierProvider<ChatController, Map<String, List<ChatMessage>>>(ChatController.new);

class ChatController extends Notifier<Map<String, List<ChatMessage>>> {
  MqttServerClient? _client;
  StreamSubscription? _sub;

  String? _currentRoom;

  @override
  Map<String, List<ChatMessage>> build() {
    state = {};
    ref.onDispose(() async {
      await disconnect();
    });
    return state;
  }

  Future<void> connectIfNeeded() async {
    final session = ref.read(sessionProvider);
    if (session == null) return;

    if (_client != null && _client!.connectionStatus?.state == MqttConnectionState.connected) {
      return;
    }

    final settings = ref.read(settingsStoreProvider).valueOrNull;
    final authBase = settings?.authBaseUrl ?? (kIsWeb ? 'http://localhost:8081' : 'http://10.0.2.2:8081');

    // derive host from authBaseUrl
    final uri = Uri.parse(authBase);
    final host = uri.host.isEmpty ? '10.0.2.2' : uri.host;

    final clientId = 'staff-app-${session.userId}-${DateTime.now().millisecondsSinceEpoch}';
    final c = MqttServerClient(host, clientId);
    c.port = 1883;
    c.keepAlivePeriod = 20;
    c.logging(on: false);

    c.onConnected = () {};
    c.onDisconnected = () {};
    c.onSubscribed = (_) {};
    c.onSubscribeFail = (topic) {};


    // opcional: username/password se o teu broker pedir (normalmente não)
    final conn = MqttConnectMessage()
        .withClientIdentifier(clientId)
        .startClean()
        .withWillQos(MqttQos.atLeastOnce);

    c.connectionMessage = conn;

    await c.connect();

    _client = c;

    _sub?.cancel();
    _sub = c.updates?.listen((events) {
      final rec = events.first;
      final payload = MqttPublishPayload.bytesToStringAsString(
        (rec.payload as MqttPublishMessage).payload.message,
      );

      try {
        final decoded = jsonDecode(payload);
        if (decoded is Map<String, dynamic>) {
          final msg = ChatMessage.tryParse(decoded);
          if (msg != null) _push(msg);
        }
      } catch (_) {
        // ignora payloads que não são JSON/chat
      }
    });
  }

  Future<void> disconnect() async {
    _sub?.cancel();
    _sub = null;
    try {
      _client?.disconnect();
    } catch (_) {}
    _client = null;
  }

  Future<void> joinRoom(String room) async {
    await connectIfNeeded();
    final c = _client;
    if (c == null) return;

    if (_currentRoom != null) {
      c.unsubscribe('stadium/chat/${_currentRoom!}');
    }

    _currentRoom = room;
    c.subscribe('stadium/chat/$room', MqttQos.atLeastOnce);
  }

  Future<void> send(String room, String text) async {
    final session = ref.read(sessionProvider);
    if (session == null) throw Exception('Sem sessão');

    await connectIfNeeded();
    final c = _client;
    if (c == null) throw Exception('MQTT não ligado');

    final msg = ChatMessage(
      room: room,
      senderId: session.userId.toString(),
      senderName: session.username,
      text: text.trim(),
      ts: DateTime.now(),
    );

    final builder = MqttClientPayloadBuilder();
    builder.addString(jsonEncode(msg.toJson()));

    c.publishMessage(
      'stadium/chat/$room',
      MqttQos.atLeastOnce,
      builder.payload!,
      retain: false,
    );

    // optimistic
    _push(msg);
  }

  void _push(ChatMessage msg) {
    final map = {...state};
    final list = [...(map[msg.room] ?? const <ChatMessage>[])];

    list.add(msg);
    // limita para não rebentar memória
    if (list.length > 200) {
      list.removeRange(0, list.length - 200);
    }

    map[msg.room] = list;
    state = map;
  }
}
