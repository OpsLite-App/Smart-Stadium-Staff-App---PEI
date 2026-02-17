import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/settings.dart';
import '../storage/settings_store.dart';
import 'service_base_urls.dart';

Dio _makeDio(String baseUrl) {
  return Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 6),
    receiveTimeout: const Duration(seconds: 12),
  ));
}

final mapDioProvider = Provider<Dio>((ref) {
  final s = ref.watch(settingsStoreProvider).valueOrNull;
  final base = s?.authBaseUrl ?? 'http://10.0.2.2:8081';
  return _makeDio(withPort(base, 8000)); // map-service
});

final congestionDioProvider = Provider<Dio>((ref) {
  final s = ref.watch(settingsStoreProvider).valueOrNull;
  final base = s?.authBaseUrl ?? 'http://10.0.2.2:8081';
  return _makeDio(withPort(base, 8005)); // congestion-service
});

final routingDioProvider = Provider<Dio>((ref) {
  final s = ref.watch(settingsStoreProvider).valueOrNull;
  final base = s?.authBaseUrl ?? 'http://10.0.2.2:8081';
  return _makeDio(withPort(base, 8002)); // routing-service
});
