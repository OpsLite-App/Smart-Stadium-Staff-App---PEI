import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../network/service_clients.dart';
import '../models/map_models.dart';

class MapService {
  MapService(this._dio);
  final Dio _dio;

  Future<List<MapNode>> fetchNodes() async {
    final resp = await _dio.get('/api/map');
    final data = resp.data;

    if (data is Map<String, dynamic>) {
      final nodes = data['nodes'];
      if (nodes is List) {
        return nodes
            .whereType<Map>()
            .map((e) => MapNode.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
    }

    // fallback: se vier diretamente uma lista
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => MapNode.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    }

    return [];
  }
}

final mapServiceProvider = Provider<MapService>((ref) {
  final dio = ref.read(mapDioProvider);
  return MapService(dio);
});
