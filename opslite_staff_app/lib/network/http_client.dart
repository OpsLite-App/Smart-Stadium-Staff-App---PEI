import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/settings.dart';
import '../storage/settings_store.dart';

String _fallbackAuthBaseUrl() =>
    kIsWeb ? 'http://localhost:8081' : 'http://10.0.2.2:8081';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: _fallbackAuthBaseUrl(),
      connectTimeout: const Duration(seconds: 6),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );

  // Aplica settings quando estiverem disponíveis (e mantém atualizado se mudarem)
  ref.listen<AsyncValue<Settings>>(settingsStoreProvider, (prev, next) {
    next.whenData((s) {
      dio.options.baseUrl = s.authBaseUrl.trim();
    });
  });

  // Se já houver valor carregado, aplica já
  final s = ref.watch(settingsStoreProvider).valueOrNull;
  if (s != null) {
    dio.options.baseUrl = s.authBaseUrl.trim();
  }

  return dio;
});
