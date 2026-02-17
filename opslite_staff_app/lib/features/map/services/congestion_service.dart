import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../network/service_clients.dart';
import '../models/map_models.dart';

class CongestionService {
  CongestionService(this._dio);
  final Dio _dio;

  Future<List<HeatPoint>> fetchHeatPoints() async {
    // endpoints comuns no teu backend: /api/heatmap/points
    final resp = await _dio.get('/api/heatmap/points');
    final data = resp.data;

    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => HeatPoint.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }

    if (data is Map<String, dynamic>) {
      final points = data['points'] ?? data['data'];
      if (points is List) {
        return points
            .whereType<Map>()
            .map((e) => HeatPoint.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
    }

    return [];
  }
}

final congestionServiceProvider = Provider<CongestionService>((ref) {
  final dio = ref.read(congestionDioProvider);
  return CongestionService(dio);
});
