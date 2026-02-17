import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../auth/role.dart';
import '../auth/session.dart';
import 'map_layer_state.dart';
import 'map_providers.dart';
import 'models/map_models.dart';

import '../team/staff_provider.dart';
import '../team/selected_staff_provider.dart';

import 'map_items.dart';
import 'map_items_provider.dart';
import 'map_item_sheet.dart';
import 'map_selection.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final MapController _mapController = MapController();

  static final LatLngBounds stadiumBounds = LatLngBounds(
    const LatLng(41.16080, -8.58660),
    const LatLng(41.16310, -8.57990),
  );

  static const LatLng stadiumCenter = LatLng(41.1618799, -8.5838921);

  static const double initialZoom = 16;
  static const double minZoom = 13;
  static const double maxZoom = 20;

  late final MapOptions _mapOptions;

  String? _lastFocusedStaffId;

  @override
  void initState() {
    super.initState();

    _mapOptions = MapOptions(
      initialCenter: stadiumCenter,
      initialZoom: initialZoom,
      minZoom: minZoom,
      maxZoom: maxZoom,
      interactionOptions: const InteractionOptions(
        flags: InteractiveFlag.drag |
            InteractiveFlag.pinchZoom |
            InteractiveFlag.doubleTapZoom |
            InteractiveFlag.scrollWheelZoom,
      ),
      cameraConstraint: CameraConstraint.contain(bounds: stadiumBounds),
      onTap: (tapPosition, point) {
        ref.read(selectedMapItemProvider.notifier).state = null;
        ref.read(selectedStaffProvider.notifier).state = null;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final role = session?.role ?? Role.security;

    final layers = ref.watch(mapLayersProvider);

    final nodesAsync = ref.watch(mapNodesProvider);
    final heatAsync = ref.watch(heatPointsProvider);
    final routeAsync = ref.watch(routeProvider);
    final assignedRoute = ref.watch(assignedRouteProvider);


    final nodes = nodesAsync.valueOrNull ?? const <MapNode>[];
    final heatPoints = ref.watch(effectiveHeatPointsProvider);
    final heatRealCount = heatAsync.valueOrNull?.length ?? 0;
    final heatEffectiveCount = heatPoints.length;
    final route = routeAsync.valueOrNull;

    final items = ref.watch(mapItemsProvider);

    final staffAsync = ref.watch(staffListProvider);
    final selectedStaff = ref.watch(selectedStaffProvider);

    // MapItems filtrados por layers
    final filteredItems = items.where((it) {
      if (it.status == 'resolved') return false;
      if (it.type == MapItemType.incident) return layers.incidents;
      if (it.type == MapItemType.bin) return layers.bins;
      return true;
    }).toList();

    final itemMarkers = _buildItemMarkers(filteredItems, nodes);


    // Staff markers reais (apenas se layer ativa)
    final staffMarkers = layers.staff
        ? _buildStaffMarkers(
            staffAsync.valueOrNull ?? const <StaffMember>[],
            nodes,
            currentUserId: session?.userId?.toString(),
            selected: selectedStaff,
          )
        : const <Marker>[];

    _maybeFocusSelectedStaff(context, selectedStaff, nodes);

    final heatCircles =
        layers.heatmap ? _buildHeatCircles(heatPoints) : const <CircleMarker>[];

    final routePolylines = <Polyline>[
      ..._buildRoutePolyline(route),
      ..._buildAssignedRoutePolyline(assignedRoute, nodes),
    ];


    final markers = <Marker>[
      ...itemMarkers,
      ...staffMarkers,
    ];

    return Stack(
      children: [
        Positioned.fill(
          child: FlutterMap(
            mapController: _mapController,
            options: _mapOptions,
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.opslite_staff_app',
              ),
              if (heatCircles.isNotEmpty) CircleLayer(circles: heatCircles),
              if (routePolylines.isNotEmpty)
                PolylineLayer(polylines: routePolylines),
              if (markers.isNotEmpty) MarkerLayer(markers: markers),

              if (nodesAsync.isLoading || heatAsync.isLoading || routeAsync.isLoading)
                const _TopStatusBanner(text: 'A carregar dados do mapa...'),
              if (nodesAsync.hasError)
                _TopStatusBanner(text: 'Erro nós: ${nodesAsync.error}'),
              if (heatAsync.hasError)
                _TopStatusBanner(text: 'Erro heatmap: ${heatAsync.error}'),
              if (routeAsync.hasError)
                _TopStatusBanner(text: 'Erro rota: ${routeAsync.error}'),
            ],
          ),
        ),

        Positioned(left: 12, top: 12, child: _RoleBadge(role: role)),

        Positioned(
          left: 12,
          top: 60,
          right: 12,
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _LayerChip(
                label: heatRealCount > 0
                    ? 'Heatmap ($heatRealCount)'
                    : 'Heatmap ($heatEffectiveCount)',
                enabled: layers.heatmap,
                icon: Icons.local_fire_department,
                onTap: () => ref.read(mapLayersProvider.notifier).toggleHeatmap(),
              ),
              _LayerChip(
                label: 'Bins',
                enabled: layers.bins,
                icon: Icons.delete_outline,
                onTap: () => ref.read(mapLayersProvider.notifier).toggleBins(),
              ),
              _LayerChip(
                label: 'Incidents',
                enabled: layers.incidents,
                icon: Icons.warning_amber,
                onTap: () => ref.read(mapLayersProvider.notifier).toggleIncidents(),
              ),
              _LayerChip(
                label: 'Staff',
                enabled: layers.staff,
                icon: Icons.person_pin_circle,
                onTap: () => ref.read(mapLayersProvider.notifier).toggleStaff(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------- Focus staff ----------------

  void _maybeFocusSelectedStaff(
    BuildContext context,
    StaffMember? selected,
    List<MapNode> nodes,
  ) {
    if (selected == null) return;
    if (_lastFocusedStaffId == selected.id) return;

    final p = _staffToLatLng(selected, nodes);
    _lastFocusedStaffId = selected.id;

    if (p == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Sem coordenadas para: ${selected.name} (loc: ${selected.location ?? "?"})',
            ),
            duration: const Duration(milliseconds: 1200),
          ),
        );
      });
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final z = _mapController.camera.zoom.clamp(minZoom, maxZoom);
      _mapController.move(p, z < 18 ? 18 : z);
    });
  }

  // ---------------- Staff markers ----------------

  List<Marker> _buildStaffMarkers(
    List<StaffMember> staff,
    List<MapNode> nodes, {
    String? currentUserId,
    StaffMember? selected,
  }) {
    final visible = staff.where((s) {
      if (currentUserId != null && s.id == currentUserId) return false;

      final p = _staffToLatLng(s, nodes);
      if (p == null) return false;

      return stadiumBounds.contains(p);
    }).toList();

    return visible.map((s) {
      final p = _staffToLatLng(s, nodes)!;
      final icon = _iconForStaffRole(s.role);
      final isSelected = selected?.id == s.id;

      return Marker(
        point: p,
        width: 48,
        height: 48,
        child: GestureDetector(
          onTap: () {
            ref.read(selectedStaffProvider.notifier).state = s;

            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('${s.name} • ${s.role}'),
                duration: const Duration(milliseconds: 900),
              ),
            );
          },
          child: Container(
            decoration: BoxDecoration(
              color: isSelected ? Colors.yellow.shade200 : Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isSelected ? Colors.orange : Colors.black12,
                width: isSelected ? 2 : 1,
              ),
              boxShadow: const [
                BoxShadow(blurRadius: 8, offset: Offset(0, 3), color: Colors.black12),
              ],
            ),
            child: Icon(icon, size: 22),
          ),
        ),
      );
    }).toList();
  }

  LatLng? _staffToLatLng(StaffMember s, List<MapNode> nodes) {
    final loc = (s.location ?? '').trim();
    if (loc.isEmpty) return null;

    // 1) "lat,lng" ou "lat lng"
    final cleaned = loc.replaceAll(';', ',').replaceAll(' ', ',');
    final parts = cleaned.split(',').where((x) => x.trim().isNotEmpty).toList();
    if (parts.length >= 2) {
      final lat = double.tryParse(parts[0]);
      final lng = double.tryParse(parts[1]);
      if (lat != null && lng != null) return LatLng(lat, lng);
    }

    // 2) nodeId (N1, N2, etc.)
    final node = nodes.where((n) => n.id == loc && n.latLng != null).toList();
    if (node.isNotEmpty) return node.first.latLng;

    // 3) "Gate-1" -> ainda não conseguimos resolver sem POIs
    return null;
  }

  IconData _iconForStaffRole(String role) {
    final r = role.toLowerCase();
    if (r.contains('security')) return Icons.shield;
    if (r.contains('clean')) return Icons.cleaning_services;
    if (r.contains('medic')) return Icons.medical_services;
    if (r.contains('super')) return Icons.supervisor_account;
    return Icons.person_pin_circle;
  }

  // ---------------- Map Items ----------------

  List<Marker> _buildItemMarkers(List<MapItem> items, List<MapNode> nodes) {
    final nodeLookup = <String, LatLng>{
      for (final n in nodes)
        if (n.latLng != null) n.id: n.latLng!,
    };

    return items.map((it) {
      final icon = it.type == MapItemType.incident
          ? Icons.warning_amber
          : Icons.delete_outline;

      final point = (it.locationNode != null && nodeLookup.containsKey(it.locationNode))
          ? nodeLookup[it.locationNode!]!
          : it.position;

      return Marker(
        point: point,
        width: 44,
        height: 44,
        child: GestureDetector(
          onTap: () => _openItemSheet(it),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              boxShadow: const [
                BoxShadow(blurRadius: 8, offset: Offset(0, 3), color: Colors.black12),
              ],
            ),
            child: Icon(icon, size: 24),
          ),
        ),
      );
    }).toList();
  }


  void _openItemSheet(MapItem item) {
    ref.read(selectedMapItemProvider.notifier).state = item;

    final session = ref.read(sessionProvider);
    final myStaffId = session?.userId?.toString();

    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) {
        return MapItemSheet(
          item: item,
          myStaffId: myStaffId,
          onRoute: () {
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Rota já desenhada após Aceitar')),
            );
          },
          onAccept: () async {
            Navigator.pop(context);
            try {
              await ref.read(mapItemsProvider.notifier).assign(item);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Atribuído com sucesso')),
              );
            } catch (e) {
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Erro ao atribuir: $e')),
              );
            }
          },
          onStart: () async {
            Navigator.pop(context);
            try {
              await ref.read(mapItemsProvider.notifier).startTask(item.id, type: item.type);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tarefa iniciada')),
              );
            } catch (e) {
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Erro no Start: $e')),
              );
            }
          },
          onComplete: () async {
            Navigator.pop(context);
            try {
              await ref.read(mapItemsProvider.notifier).completeTask(item.id, type: item.type);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tarefa concluída')),
              );
            } catch (e) {
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Erro no Complete: $e')),
              );
            }
          },
          onChat: () {
            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('TODO: abrir chat')),
            );
          },
        );
      },
    );
  }


  // ---------------- Heat / Route ----------------

  List<CircleMarker> _buildHeatCircles(List<HeatPoint> points) {
    return points.map((p) {
      final radius = 10 + (p.intensity * 22);
      final alpha = (60 + p.intensity * 140).toInt().clamp(40, 200);

      return CircleMarker(
        point: p.point,
        radius: radius,
        color: Colors.red.withAlpha(alpha),
        borderColor: Colors.red.withAlpha((alpha * 0.7).toInt()),
        borderStrokeWidth: 1,
      );
    }).toList();
  }

  List<Polyline> _buildRoutePolyline(RoutePath? route) {
    if (route == null || route.points.isEmpty) return const [];
    return [
      Polyline(points: route.points, strokeWidth: 5, color: Colors.blue),
    ];
  }

  List<Polyline> _buildAssignedRoutePolyline(AssignedRoute? assigned, List<MapNode> nodes) {
    if (assigned == null || assigned.routeNodes.isEmpty) return const [];

    // nodeId -> LatLng
    final lookup = <String, LatLng>{
      for (final n in nodes)
        if (n.latLng != null) n.id: n.latLng!,
    };

    final pts = <LatLng>[];
    for (final id in assigned.routeNodes) {
      final p = lookup[id];
      if (p != null) pts.add(p);
    }

    if (pts.length < 2) return const [];

    return [
      // cor diferente da rota manual (routeProvider)
      Polyline(points: pts, strokeWidth: 5, color: Colors.purple),
    ];
  }

}

class _TopStatusBanner extends StatelessWidget {
  const _TopStatusBanner({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 12,
      right: 12,
      bottom: 12,
      child: Material(
        elevation: 6,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.95),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            text,
            style: const TextStyle(fontSize: 12),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.role});
  final Role role;

  @override
  Widget build(BuildContext context) {
    final label = switch (role) {
      Role.security => 'Security • Active',
      Role.cleaning => 'Cleaning • Active',
      Role.medic => 'Medic • Active',
      Role.supervisor => 'Supervisor • Active',
    };

    final icon = switch (role) {
      Role.security => Icons.shield,
      Role.cleaning => Icons.cleaning_services,
      Role.medic => Icons.medical_services,
      Role.supervisor => Icons.supervisor_account,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.95),
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(blurRadius: 10, offset: Offset(0, 4), color: Colors.black12),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _LayerChip extends StatelessWidget {
  const _LayerChip({
    required this.label,
    required this.enabled,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      onPressed: onTap,
      avatar: Icon(icon, size: 18),
      label: Text(label),
      backgroundColor: enabled ? Colors.white : Colors.grey.shade300,
      labelStyle: TextStyle(
        fontWeight: FontWeight.w600,
        color: enabled ? Colors.black : Colors.black54,
      ),
      side: BorderSide(color: enabled ? Colors.black12 : Colors.black26),
    );
  }
}
