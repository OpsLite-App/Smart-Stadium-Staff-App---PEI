import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/settings_store.dart';
import '../network/service_base_urls.dart';
import 'realtime_hub.dart';

final realtimeHubProvider = Provider<RealtimeHub>((ref) {
  final settings = ref.watch(settingsStoreProvider).valueOrNull;

  // authBaseUrl serve como base para compor as portas
  final authBase = settings?.authBaseUrl ?? 'http://10.0.2.2:8081';

  // WS gateway (8089)
  final wsBaseHttp = withPort(authBase, 8089); // ex: http://10.0.2.2:8089
  final wsUrl = wsBaseHttp.replaceFirst('http', 'ws') + '/ws';

  return RealtimeHub(
    wsUrl: wsUrl,
    tokenProviderNameForDebug: 'RealtimeHub',
  );
});
