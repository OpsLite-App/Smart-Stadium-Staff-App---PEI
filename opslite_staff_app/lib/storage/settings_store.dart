import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

class SettingsStore {
  SettingsStore(this._prefs);

  final SharedPreferences _prefs;

  static const _kAuthBaseUrl = 'auth_base_url';
  static const _kWsUrl = 'ws_url';

  String get authBaseUrl =>
      _prefs.getString(_kAuthBaseUrl) ?? AppDefaults.defaultAuthBaseUrl;

  String get wsUrl => _prefs.getString(_kWsUrl) ?? AppDefaults.defaultWsUrl;

  Future<void> setAuthBaseUrl(String value) =>
      _prefs.setString(_kAuthBaseUrl, value);

  Future<void> setWsUrl(String value) => _prefs.setString(_kWsUrl, value);
}

final settingsStoreProvider = FutureProvider<SettingsStore>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return SettingsStore(prefs);
});
