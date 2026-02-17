import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../storage/settings_store.dart';
import '../../network/service_base_urls.dart';
import '../auth/session.dart';

final sosControllerProvider =
    StateNotifierProvider<SosController, AsyncValue<void>>((ref) {
  return SosController(ref);
});

class SosController extends StateNotifier<AsyncValue<void>> {
  SosController(this.ref) : super(const AsyncValue.data(null));

  final Ref ref;

  /// Retorna o DTO (Map) do incidente criado para o MapItemsController ingerir.
    Future<Map<String, dynamic>> createSosIncident({
        required String incidentType,          
        required String severity,              
        required String locationNode,
        required String locationDescription,
    String? description,                   
        }) async {
        state = const AsyncValue.loading();

        final session = ref.read(sessionProvider);
        final token = session?.token;
        if (token == null || token.trim().isEmpty) {
            state = const AsyncValue.data(null);
            throw Exception('Sem token (sessão inválida).');
        }

        final settings = ref.read(settingsStoreProvider).valueOrNull;
        final authBase = settings?.authBaseUrl ?? 'http://10.0.2.2:8081';
        final baseUrl = withPort(authBase, 8006);

        final dio = Dio(
            BaseOptions(
            baseUrl: baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
            },
            connectTimeout: const Duration(seconds: 8),
            receiveTimeout: const Duration(seconds: 12),
            sendTimeout: const Duration(seconds: 12),
            ),
        );

        try {
            final res = await dio.post(
            '/api/emergency/incidents',
            queryParameters: const {'auto_dispatch': true},
            data: {
                "incident_type": incidentType,                 // ✅ agora configurável
                "location_node": locationNode,
                "severity": severity,                          // ✅ agora configurável
                "description": (description?.trim().isNotEmpty ?? false)
                    ? description!.trim()
                    : "SOS acionado via app",
                "location_description": locationDescription,
                "detected_by": "staff",
                "reported_by": session!.userId.toString(),
                "incident_metadata": {
                "source": "staff_app_sos",
                "kind": "sos",
                }
            },
            );

            final data = res.data;
            if (data is Map) {
            state = const AsyncValue.data(null);
            return Map<String, dynamic>.from(data);
            }

            state = const AsyncValue.data(null);
            throw Exception('Resposta inesperada do servidor.');
        } catch (e, st) {
            state = AsyncValue.error(e, st);
            rethrow;
        }
    }

  

}
