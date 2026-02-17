import 'package:latlong2/latlong.dart';

double? _toDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

String _str(dynamic v, {String fallback = ''}) {
  if (v == null) return fallback;
  return v.toString();
}

class MapNode {
  final String id;
  final LatLng? latLng; // null se backend não tiver coords geográficas

  const MapNode({
    required this.id,
    required this.latLng,
  });

  factory MapNode.fromJson(Map<String, dynamic> json) {
    final id = _str(json['id'] ?? json['node_id'] ?? json['name']);

    // Backend do map-service:
    // {"id":"N1","x":41.1613,"y":-8.5845,...}
    // x = latitude, y = longitude
    final lat = _toDouble(json['lat'] ?? json['latitude'] ?? json['x']);
    final lng = _toDouble(json['lng'] ?? json['lon'] ?? json['longitude'] ?? json['y']);

    final has = (lat != null && lng != null);
    return MapNode(
      id: id,
      latLng: has ? LatLng(lat!, lng!) : null,
    );
  }
}

class HeatPoint {
  final LatLng point;
  final double intensity; // 0..1

  const HeatPoint({required this.point, required this.intensity});

  factory HeatPoint.fromJson(Map<String, dynamic> json) {
    final lat = _toDouble(json['lat'] ?? json['latitude'] ?? json['x']) ?? 0;
    final lng = _toDouble(json['lng'] ?? json['lon'] ?? json['longitude'] ?? json['y']) ?? 0;

    final raw = _toDouble(
          json['weight'] ?? 
              json['intensity'] ??
              json['value'] ??
              json['people'] ??
              json['count'] ??
              json['density'],
        ) ??
        0;

    final intensity = raw <= 1 ? raw : (raw / 100.0).clamp(0.0, 1.0);

    return HeatPoint(
      point: LatLng(lat, lng),
      intensity: intensity.clamp(0.0, 1.0),
    );
  }
}

class RoutePath {
  final List<LatLng> points;
  const RoutePath(this.points);
}
