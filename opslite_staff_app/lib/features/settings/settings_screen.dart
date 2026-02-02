import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../network/http_client.dart';
import '../../storage/settings_store.dart';
import '../../ws/stomp_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _authCtrl = TextEditingController();
  final _wsCtrl = TextEditingController();

  String? _result;
  bool _testing = false;

  @override
  void dispose() {
    _authCtrl.dispose();
    _wsCtrl.dispose();
    super.dispose();
  }

  Future<void> _save(SettingsStore settings) async {
    await settings.setAuthBaseUrl(_authCtrl.text.trim());
    await settings.setWsUrl(_wsCtrl.text.trim());
    setState(() => _result = 'Guardado ✅');
  }

  Future<void> _testConnection(SettingsStore settings) async {
  setState(() {
    _testing = true;
    _result = null;
  });

  final dio = ref.read(dioProvider);
  final stomp = ref.read(stompServiceProvider);

  String httpStatus;
  String wsStatus;

  // 1) Teste HTTP: /auth/staff
  try {
    final resp = await dio.getUri(Uri.parse('${settings.authBaseUrl}/auth/staff'));
    httpStatus = resp.statusCode == 200 ? 'OK' : 'FAIL(${resp.statusCode})';
  } on DioException catch (e) {
    final code = e.response?.statusCode;
    httpStatus = 'FAIL(${code ?? e.message})';
  } catch (e) {
    httpStatus = 'FAIL($e)';
  }

  // 2) Teste WS: STOMP CONNECT
  try {
    final tmpStomp = StompService(settings.wsUrl);
    await tmpStomp.connect();
    await tmpStomp.disconnect();
    wsStatus = 'CONNECTED ✅';
  } catch (e) {
    wsStatus = 'FAIL($e)';
  }


  setState(() {
    _result = 'HTTP(${settings.authBaseUrl}): $httpStatus | WS(${settings.wsUrl}): $wsStatus';

    _testing = false;
  });
}


  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(settingsStoreProvider);

    return settingsAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('Settings error: $e'))),
      data: (settings) {
        // Preenche controllers apenas uma vez quando o store chega
        if (_authCtrl.text.isEmpty) _authCtrl.text = settings.authBaseUrl;
        if (_wsCtrl.text.isEmpty) _wsCtrl.text = settings.wsUrl;

        return Scaffold(
          appBar: AppBar(title: const Text('Settings')),
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text('Backend URLs', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              TextField(
                controller: _authCtrl,
                decoration: const InputDecoration(
                  labelText: 'AUTH_BASE_URL',
                  hintText: 'http://10.0.2.2:8081',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _wsCtrl,
                decoration: const InputDecoration(
                  labelText: 'WS_STOMP_URL',
                  hintText: 'ws://10.0.2.2:8089/ws',
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _testing ? null : () => _save(settings),
                      child: const Text('Guardar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _testing ? null : () => _testConnection(settings),
                      child: _testing
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Testar ligação'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_result != null) Text(_result!, style: const TextStyle(fontSize: 16)),
              const SizedBox(height: 24),
              const Text(
                'Notas:\n'
                '- Android emulator: 10.0.2.2\n'
                '- Web/iOS simulator: localhost\n'
                '- Telemóvel real: IP do PC\n',
              ),
            ],
          ),
        );
      },
    );
  }
}
