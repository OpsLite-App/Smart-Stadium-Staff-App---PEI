import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/settings_store.dart';

final dioProvider = Provider<Dio>((ref) {
  final settingsAsync = ref.watch(settingsStoreProvider);

  // Se ainda está a carregar, usa um Dio "dummy" (não vai ser usado antes de o ecrã estar pronto)
  final baseUrl = settingsAsync.maybeWhen(
    data: (s) => s.authBaseUrl,
    orElse: () => '',
  );

  return Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ),
  );
});
