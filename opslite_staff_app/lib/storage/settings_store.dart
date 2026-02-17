import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'settings.dart';

const _kAuthBaseUrl = 'AUTH_BASE_URL';
const _kWsUrl = 'WS_STOMP_URL';

String _defaultAuthBaseUrl() =>
    kIsWeb ? 'http://localhost:8081' : 'http://10.0.2.2:8081';

String _defaultWsUrl() =>
    kIsWeb ? 'ws://localhost:8089/ws' : 'ws://10.0.2.2:8089/ws';

class SettingsStore extends AsyncNotifier<Settings> {
  @override
  Future<Settings> build() async {
    final prefs = await SharedPreferences.getInstance();

    final storedAuth = (prefs.getString(_kAuthBaseUrl) ?? '').trim();
    final storedWs = (prefs.getString(_kWsUrl) ?? '').trim();

    final authBaseUrl = storedAuth.isEmpty ? _defaultAuthBaseUrl() : storedAuth;
    final wsUrl = storedWs.isEmpty ? _defaultWsUrl() : storedWs;

    if (storedAuth.isEmpty) {
      await prefs.setString(_kAuthBaseUrl, authBaseUrl);
    }
    if (storedWs.isEmpty) {
      await prefs.setString(_kWsUrl, wsUrl);
    }

    return Settings(authBaseUrl: authBaseUrl, wsUrl: wsUrl);
  }

  Future<void> setAuthBaseUrl(String value) async {
    final v = value.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAuthBaseUrl, v);

    // atualiza estado imediatamente
    state = AsyncData(state.requireValue.copyWith(authBaseUrl: v));
  }

  Future<void> setWsUrl(String value) async {
    final v = value.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kWsUrl, v);

    state = AsyncData(state.requireValue.copyWith(wsUrl: v));
  }

  Future<void> resetToDefaults() async {
    final prefs = await SharedPreferences.getInstance();
    final auth = _defaultAuthBaseUrl();
    final ws = _defaultWsUrl();

    await prefs.setString(_kAuthBaseUrl, auth);
    await prefs.setString(_kWsUrl, ws);

    state = AsyncData(Settings(authBaseUrl: auth, wsUrl: ws));
  }
}

final settingsStoreProvider =
    AsyncNotifierProvider<SettingsStore, Settings>(SettingsStore.new);
