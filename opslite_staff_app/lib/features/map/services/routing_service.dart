import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../network/service_clients.dart';
import '../models/map_models.dart';

class RoutingService {
  RoutingService(this._dio);
  final Dio _dio;

  Future<RoutePath> fetchRoute({
    required String fromNodeId,
    required String toNodeId,
  }) async {
    final resp = await _dio.get('/api/route', queryParameters: {
      'from': fromNodeId,
      'to': toNodeId,
    });

    final data = resp.data;

    List<LatLng> parsePoints(dynamic v) {
      if (v is List) {
        return v
            .whereType<Map>()
            .map((e) {
              final m = Map<String, dynamic>.from(e);
              final lat = m['lat'] ?? m['latitude'] ?? m['y'];
              final lng = m['lng'] ?? m['lon'] ?? m['longitude'] ?? m['x'];
              if (lat is! num || lng is! num) return null;
              return LatLng(lat.toDouble(), lng.toDouble());
            })
            .whereType<LatLng>()
            .toList();
      }
      return [];
    }

    if (data is Map<String, dynamic>) {
      final pts = data['path'] ?? data['points'] ?? data['route'];
      return RoutePath(parsePoints(pts));
    }

    if (data is List) {
      return RoutePath(parsePoints(data));
    }

    return const RoutePath([]);
  }
}

final routingServiceProvider = Provider<RoutingService>((ref) {
  final dio = ref.read(routingDioProvider);
  return RoutingService(dio);
});
