import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:math';
import 'package:latlong2/latlong.dart';
import 'models/map_models.dart';
import 'services/map_service.dart';
import 'services/congestion_service.dart';
import 'services/routing_service.dart';

final mapNodesProvider = FutureProvider<List<MapNode>>((ref) async {
  final svc = ref.read(mapServiceProvider);
  return svc.fetchNodes();
});

final heatPointsProvider = FutureProvider<List<HeatPoint>>((ref) async {
  final svc = ref.read(congestionServiceProvider);
  return svc.fetchHeatPoints();
});

final routeProvider = FutureProvider<RoutePath?>((ref) async {
  final from = ref.watch(routeFromNodeIdProvider);
  final to = ref.watch(routeToNodeIdProvider);

  if (from == null || to == null) return null;

  final svc = ref.read(routingServiceProvider);
  return svc.fetchRoute(fromNodeId: from, toNodeId: to);
});

final routeFromNodeIdProvider = StateProvider<String?>((ref) => null);
final routeToNodeIdProvider = StateProvider<String?>((ref) => null);


final effectiveHeatPointsProvider = Provider<List<HeatPoint>>((ref) {
  final real = ref.watch(heatPointsProvider).valueOrNull ?? const <HeatPoint>[];

  if (real.isNotEmpty) return real;

  // bounds do Dragão (iguais aos do MapScreen)
  const sw = LatLng(41.16080, -8.58660);
  const ne = LatLng(41.16310, -8.57990);

  final rnd = Random(42);
  final pts = List.generate(25, (i) {
    final lat = sw.latitude + rnd.nextDouble() * (ne.latitude - sw.latitude);
    final lng = sw.longitude + rnd.nextDouble() * (ne.longitude - sw.longitude);
    final intensity = 0.2 + rnd.nextDouble() * 0.8;
    return HeatPoint(point: LatLng(lat, lng), intensity: intensity);
  });

  return pts;
});

/// Rota devolvida pelo maintenance-service no momento do assign.
/// Vem como lista de node IDs ("N1", "N2", ...), não como pontos.
class AssignedRoute {
  final String taskId;
  final List<String> routeNodes;
  final double? distanceMeters;
  final int? etaSeconds;

  const AssignedRoute({
    required this.taskId,
    required this.routeNodes,
    this.distanceMeters,
    this.etaSeconds,
  });
}

/// Última rota operacional (assign) para desenhar no mapa.
/// Substitui-se a cada novo assign; pode ser limpa ao completar.
final assignedRouteProvider = StateProvider<AssignedRoute?>((ref) => null);
