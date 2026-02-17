import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../storage/settings_store.dart';
import 'auth_service.dart';
import 'role.dart';
import 'session.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  static const _androidAuth = 'http://10.0.2.2:8081';
  static const _androidWs = 'ws://10.0.2.2:8089/ws';

  static const _localAuth = 'http://localhost:8081';
  static const _localWs = 'ws://localhost:8089/ws';

  final _userCtrl = TextEditingController(text: 'john.doe@example.com');
  final _passCtrl = TextEditingController(text: 'password');

  bool _loading = false;
  String? _error;

  Future<void> _setAndroid() async {
    setState(() => _error = null);
    final store = ref.read(settingsStoreProvider.notifier);
    await store.setAuthBaseUrl(_androidAuth);
    await store.setWsUrl(_androidWs);
  }

  Future<void> _setLocalhost() async {
    setState(() => _error = null);
    final store = ref.read(settingsStoreProvider.notifier);
    await store.setAuthBaseUrl(_localAuth);
    await store.setWsUrl(_localWs);
  }

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = ref.read(authServiceProvider);

      final result = await auth.login(
        username: _userCtrl.text.trim(),
        password: _passCtrl.text.trim(),
      );

      ref.read(sessionProvider.notifier).login(
        SessionState(
          userId: result.userId,
          username: _userCtrl.text.trim(),
          role: RoleX.fromString(result.role.toLowerCase()),
          token: result.token,
        ),
      );

      if (mounted) context.go('/app');
    } catch (e) {
      // mostra o erro real
      String msg = 'Erro ao fazer login';
      if (e is DioException) {
        final status = e.response?.statusCode;
        final data = e.response?.data;
        if (status == null) {
          msg = 'Sem resposta do servidor (URL errada / servidor em baixo)';
        } else {
          msg = 'HTTP $status - $data';
        }
      } else {
        msg = e.toString();
      }
      setState(() => _error = msg);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(settingsStoreProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erro a carregar settings: $e')),
        data: (settings) {
          final isAndroid = settings.authBaseUrl.trim() == _androidAuth;
          final isLocal = settings.authBaseUrl.trim() == _localAuth;

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : _setAndroid,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            width: 2,
                            color: isAndroid
                                ? Theme.of(context).colorScheme.primary
                                : Colors.grey,
                          ),
                        ),
                        child: const Text('Android Emulator'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : _setLocalhost,
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(
                            width: 2,
                            color: isLocal
                                ? Theme.of(context).colorScheme.primary
                                : Colors.grey,
                          ),
                        ),
                        child: const Text('Browser / Desktop'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'AUTH: ${settings.authBaseUrl}\nWS: ${settings.wsUrl}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _userCtrl,
                  decoration: const InputDecoration(labelText: 'Username'),
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passCtrl,
                  decoration: const InputDecoration(labelText: 'Password'),
                  obscureText: true,
                  onSubmitted: (_) => _loading ? null : _login(),
                ),
                const SizedBox(height: 12),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 8),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    child: _loading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Entrar'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
