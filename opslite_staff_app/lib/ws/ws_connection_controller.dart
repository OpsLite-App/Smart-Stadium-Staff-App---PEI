import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/session.dart';
import '../realtime/realtime_hub_provider.dart';

final wsConnectionControllerProvider =
    Provider.autoDispose<WsConnectionController>((ref) {
  final c = WsConnectionController(ref);
  c._init();
  return c;
});

class WsConnectionController {
  WsConnectionController(this.ref);

  final Ref ref;
  bool _started = false;

  void _init() {
    if (_started) return;
    _started = true;

    // Se já houver sessão ativa ao iniciar
    final current = ref.read(sessionProvider);
    if (current != null) {
      _connect(current);
    }

    // Sempre que a sessão mudar
    ref.listen<SessionState?>(sessionProvider, (prev, next) async {
      final hub = ref.read(realtimeHubProvider);

      if (next == null) {
        await hub.disconnect();
        return;
      }

      await _connect(next);
    });
  }

  Future<void> _connect(SessionState session) async {
    final hub = ref.read(realtimeHubProvider);

    await hub.connect(
      token: session.token,
      role: session.role.name,
    );
  }
}
