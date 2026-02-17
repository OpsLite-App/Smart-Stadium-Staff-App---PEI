import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../storage/settings_store.dart';
import '../auth/session.dart';
import '../../realtime/realtime_hub_provider.dart';
import '../../domain/events/emergency_event.dart';
import '../../domain/events/maintenance_event.dart';
import '../../network/service_base_urls.dart';
import 'map_items.dart';
import '../team/staff_provider.dart';
import '../team/selected_staff_provider.dart';
import 'map_providers.dart';

final mapItemsProvider =
    NotifierProvider<MapItemsController, List<MapItem>>(MapItemsController.new);

class MapItemsController extends Notifier<List<MapItem>> {
  StreamSubscription<EmergencyEvent>? _emergSub;
  StreamSubscription<MaintenanceEvent>? _maintSub;

  bool _bootstrapped = false;

  @override
  List<MapItem> build() {
    state = const [];

    _attachRealtimeListeners();
    _bootstrapOnce();

    ref.onDispose(() {
      _emergSub?.cancel();
      _maintSub?.cancel();
    });

    return state;
  }
  Future<void> _calculateAndStoreIncidentRoute({
    required String incidentId,
    required int staffId,
    required String? toNode,
  }) async {
    final dest = (toNode ?? '').trim().toUpperCase();
    if (dest.isEmpty) return;

    final fromNode = _bestEffortCurrentLocationNodeId(staffId).trim().toUpperCase();
    if (fromNode.isEmpty) return;

    final dio = _dioForService(port: 8002); // routing-service

    final resp = await dio.get(
      '/api/route',
      queryParameters: {
        'from_node': fromNode,
        'to_node': dest,
        'avoid_crowds': false,
      },
    );

    final data = resp.data;
    if (data is! Map) return;

    final m = Map<String, dynamic>.from(data);

    final pathRaw = m['path'];
    final path = (pathRaw is List)
        ? pathRaw.map((e) => e.toString()).where((s) => s.trim().isNotEmpty).toList()
        : const <String>[];

    final distanceMeters = (m['distance'] is num)
        ? (m['distance'] as num).toDouble()
        : double.tryParse('${m['distance']}');

    final etaSeconds = (m['eta_seconds'] is num)
        ? (m['eta_seconds'] as num).toInt()
        : int.tryParse('${m['eta_seconds']}');

    if (path.isEmpty) return;

    ref.read(assignedRouteProvider.notifier).state = AssignedRoute(
      taskId: incidentId.trim(),
      routeNodes: path,
      distanceMeters: distanceMeters,
      etaSeconds: etaSeconds,
    );
  }

  // -----------------------------
  // PUBLIC: Assign action
  // -----------------------------

  Future<void> assign(MapItem item) async {
    final session = ref.read(sessionProvider);
    final staffId = session?.userId;
    if (staffId == null) {
      throw Exception('Sem sessão ativa (staffId null)');
    }

    // Só aceitar se estiver em estado "open"
    // (active -> open via normalize)
    final normalized = _normalizeStatus(item.status);
    if (normalized != 'open') return;

    // optimistic update (UI imediata)
    // Para incidentes, o backend usa "investigating" como "aceite"
    final optimisticStatus =
        item.type == MapItemType.incident ? 'assigned' : 'assigned';

    _patchStatus(
      id: item.id,
      type: item.type,
      status: optimisticStatus,
      assignedTo: staffId.toString(),
    );

    try {
      if (item.type == MapItemType.incident) {
        await _assignIncident(itemId: item.id, staffId: staffId);

        // refresh do incidente para ter location_node/metadata atual
        final updated = await _fetchIncidentById(item.id).catchError((_) => null);
        if (updated != null) _upsert(updated);

        // calcular rota (usa locationNode do item atualizado se existir)
        await _calculateAndStoreIncidentRoute(
          incidentId: item.id,
          staffId: staffId,
          toNode: (updated?.locationNode ?? item.locationNode),
        ).catchError((_) {});
      } else {
        await _assignBin(itemId: item.id, staffId: staffId);
        final updated =
            await _fetchBinAlertById(item.id).catchError((_) => null);
        if (updated != null) _upsert(updated);
      }
    } catch (e) {
      // rollback simples para open (se falhar)
      _patchStatus(
        id: item.id,
        type: item.type,
        status: 'open',
        assignedTo: null,
      );
      rethrow;
    }
  }

  Future<void> _assignIncident({
    required String itemId,
    required int staffId,
  }) async {
    final dio = _dioForService(port: 8006); // emergency-service

    // Aceitar = status "investigating" + assigned_to em incident_metadata (merge)
    await dio.patch(
      '/api/emergency/incidents/$itemId',
      data: {
        "status": "investigating",
        "notes": "Accepted by staff $staffId",
        "incident_metadata": {
          "assigned_to": staffId.toString(),
        }
      },
    );
  }

  Future<void> _assignBin({
    required String itemId,
    required int staffId,
  }) async {
    final dio = _dioForService(port: 8007); // maintenance-service

    final payload = <String, dynamic>{
      'task_id': itemId.trim(),
      'staff_id': staffId.toString(),
      'calculate_route': true,
    };

    Future<Response<dynamic>> doAssign() {
      return dio.post(
        '/api/maintenance/assign',
        data: payload,
        options: Options(
          headers: {'Content-Type': 'application/json'},
        ),
      );
    }

    try {
      final res = await doAssign();
      _handleAssignResponse(itemId: itemId, responseData: res.data);
      return;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final body = e.response?.data;

      // Lazy register: maintenance-service pode devolver 400 quando o staff não está registado
      if (status == 400) {
        await _registerCurrentStaffInMaintenance(dio: dio, staffId: staffId);

        // retry 1 vez
        final res2 = await doAssign();
        _handleAssignResponse(itemId: itemId, responseData: res2.data);
        return;
      }

      // ignore: avoid_print
      print('ASSIGN BIN ERROR status=$status payload=$payload body=$body');
      rethrow;
    }
  }

  Future<void> startTask(String taskId, {MapItemType type = MapItemType.bin}) async {
    // optimistic UI
    _patchStatus(
      id: taskId,
      type: type,
      status: 'in_progress',
    );

    try {
      if (type == MapItemType.incident) {
        final dio = _dioForService(port: 8006); // emergency-service
        await dio.patch(
          '/api/emergency/incidents/${taskId.trim()}',
          data: {
            "status": "responding",
          },
        );

        final updated =
            await _fetchIncidentById(taskId).catchError((_) => null);
        if (updated != null) _upsert(updated);
        return;
      }

      // maintenance-service
      final dio = _dioForService(port: 8007);
      await dio.post('/api/maintenance/tasks/${taskId.trim()}/start');

      final updated =
          await _fetchBinAlertById(taskId).catchError((_) => null);
      if (updated != null) _upsert(updated);
    } catch (e) {
      // rollback -> assigned
      _patchStatus(
        id: taskId,
        type: type,
        status: 'assigned',
      );
      rethrow;
    }
  }

  Future<void> completeTask(
    String taskId, {
    String? notes,
    MapItemType type = MapItemType.bin,
  }) async {
    // optimistic UI
    _patchStatus(
      id: taskId,
      type: type,
      status: 'resolved',
    );

    try {
      if (type == MapItemType.incident) {
        final dio = _dioForService(port: 8006); // emergency-service

        await dio.post(
          '/api/emergency/incidents/${taskId.trim()}/resolve',
          queryParameters: {
            if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
          },
        );

        final updated =
            await _fetchIncidentById(taskId).catchError((_) => null);
        if (updated != null) _upsert(updated);

        ref.read(assignedRouteProvider.notifier).state = null;
        return;
      }

      // maintenance-service
      final dio = _dioForService(port: 8007);
      await dio.post(
        '/api/maintenance/tasks/${taskId.trim()}/complete',
        queryParameters: {
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );

      ref.read(assignedRouteProvider.notifier).state = null;

      final updated =
          await _fetchBinAlertById(taskId).catchError((_) => null);
      if (updated != null) _upsert(updated);
    } catch (e) {
      // rollback -> in_progress
      _patchStatus(
        id: taskId,
        type: type,
        status: 'in_progress',
      );
      rethrow;
    }
  }

  // -----------------------------
  // Lazy staff register (maintenance)
  // -----------------------------

  Future<void> _registerCurrentStaffInMaintenance({
    required Dio dio,
    required int staffId,
  }) async {
    final session = ref.read(sessionProvider);

    var name = session?.username ?? 'Staff $staffId';
    var role = session?.role.name ?? 'cleaning';
    var currentLocation = _bestEffortCurrentLocationNodeId(staffId);

    final selected = ref.read(selectedStaffProvider);
    if (selected != null && selected.id == staffId.toString()) {
      name = selected.name;
      role = selected.role;
      currentLocation = (selected.location ?? currentLocation);
    }

    if (!currentLocation.trim().toUpperCase().startsWith('N')) {
      currentLocation = 'N1';
    }

    await dio.post(
      '/api/maintenance/staff/register',
      queryParameters: {
        'staff_id': staffId.toString(),
        'name': name,
        'role': role,
        'current_location': currentLocation,
      },
    );
  }

  String _bestEffortCurrentLocationNodeId(int staffId) {
    final staffList =
        ref.read(staffListProvider).valueOrNull ?? const <StaffMember>[];
    final mine = staffList.where((s) => s.id == staffId.toString()).toList();
    if (mine.isNotEmpty) {
      final loc = (mine.first.location ?? '').trim();
      if (loc.isNotEmpty) return loc;
    }
    return 'N1';
  }

  // Guarda rota devolvida pelo assign (route_nodes, distance, eta)
  void _handleAssignResponse({
    required String itemId,
    required dynamic responseData,
  }) {
    if (responseData is! Map) return;
    final data = Map<String, dynamic>.from(responseData);

    final nodesRaw = data['route_nodes'];
    final routeNodes = (nodesRaw is List)
        ? nodesRaw
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList()
        : const <String>[];

    final distanceMeters = (data['route_distance'] is num)
        ? (data['route_distance'] as num).toDouble()
        : double.tryParse('${data['route_distance']}');

    final etaSeconds = (data['eta_seconds'] is num)
        ? (data['eta_seconds'] as num).toInt()
        : int.tryParse('${data['eta_seconds']}');

    if (routeNodes.isNotEmpty) {
      ref.read(assignedRouteProvider.notifier).state = AssignedRoute(
        taskId: itemId.trim(),
        routeNodes: routeNodes,
        distanceMeters: distanceMeters,
        etaSeconds: etaSeconds,
      );
    }
  }

  /// Permite inserir um incidente criado (ex.: SOS) diretamente no state.
  void ingestIncidentDto(Map<String, dynamic> dto) {
    final item = _incidentToMapItem(dto);
    if (item != null) {
      _upsert(item);
    }
  }

  // -----------------------------
  // Realtime listeners (WS)
  // -----------------------------

  void _attachRealtimeListeners() {
    if (_emergSub != null || _maintSub != null) return;

    final hub = ref.read(realtimeHubProvider);

    _emergSub = hub.emergency.listen((ev) async {
      // ev.id tem de bater com o ID do incidente
      final updated = await _fetchIncidentById(ev.id).catchError((_) => null);
      if (updated != null) {
        _upsert(updated);
      } else {
        _patchStatus(
          id: ev.id,
          type: MapItemType.incident,
          status: ev.status,
        );
      }
    });

    _maintSub = hub.maintenance.listen((ev) async {
      // ev.binId (no teu event) pode ser bin_id OU task_id
      final updated =
          await _fetchBinAlertById(ev.binId).catchError((_) => null);
      if (updated != null) {
        _upsert(updated);
      } else {
        _patchStatus(
          id: ev.binId,
          type: MapItemType.bin,
          status: ev.status,
        );
      }
    });
  }

  // -----------------------------
  // Bootstrap (REST)
  // -----------------------------

  void _bootstrapOnce() {
    if (_bootstrapped) return;
    _bootstrapped = true;

    Future.microtask(() async {
      final incidents = await _fetchIncidents().catchError((_) => <MapItem>[]);
      final bins = await _fetchBinAlerts().catchError((_) => <MapItem>[]);

      final merged = <String, MapItem>{};
      for (final it in [...incidents, ...bins]) {
        merged[_key(it.type, it.id)] = it;
      }

      final list = merged.values.toList()
        ..sort((a, b) {
          final pa = _priorityRank(a.priority);
          final pb = _priorityRank(b.priority);
          if (pa != pb) return pb.compareTo(pa);

          final ta = a.createdAt?.millisecondsSinceEpoch ?? 0;
          final tb = b.createdAt?.millisecondsSinceEpoch ?? 0;
          return tb.compareTo(ta);
        });

      state = list;
    });
  }

  Future<List<MapItem>> _fetchIncidents() async {
    final dio = _dioForService(port: 8006);
    final resp = await dio.get('/api/emergency/incidents');
    final data = resp.data;

    final list = _extractList(data, keys: const ['incidents', 'data', 'items']);
    return list
        .whereType<Map>()
        .map((m) => _incidentToMapItem(Map<String, dynamic>.from(m)))
        .whereType<MapItem>()
        .toList();
  }

  Future<MapItem?> _fetchIncidentById(String id) async {
    if (id.trim().isEmpty) return null;

    final dio = _dioForService(port: 8006);
    final resp = await dio.get('/api/emergency/incidents/$id');
    final data = resp.data;

    if (data is Map) {
      return _incidentToMapItem(Map<String, dynamic>.from(data));
    }

    if (data is Map<String, dynamic>) {
      final inner = data['incident'];
      if (inner is Map) {
        return _incidentToMapItem(Map<String, dynamic>.from(inner));
      }
    }

    return null;
  }

  Future<List<MapItem>> _fetchBinAlerts() async {
    final dio = _dioForService(port: 8007);
    final resp = await dio.get('/api/maintenance/bins/alerts');
    final data = resp.data;

    final list = _extractList(data, keys: const ['alerts', 'data', 'items']);
    return list
        .whereType<Map>()
        .map((m) => _binAlertToMapItem(Map<String, dynamic>.from(m)))
        .whereType<MapItem>()
        .toList();
  }

  Future<MapItem?> _fetchBinAlertById(String binOrTaskId) async {
    if (binOrTaskId.trim().isEmpty) return null;

    // Como o endpoint de alerts não é por-id, fazemos fetch e filtramos
    final alerts = await _fetchBinAlerts();
    try {
      return alerts.firstWhere(
          (a) => a.type == MapItemType.bin && a.id == binOrTaskId.trim());
    } catch (_) {
      return _maybeExisting(MapItemType.bin, binOrTaskId);
    }
  }

  // -----------------------------
  // State merge / patch
  // -----------------------------

  void _upsert(MapItem item) {
    final k = _key(item.type, item.id);

    final map = <String, MapItem>{
      for (final it in state) _key(it.type, it.id): it,
    };

    final prev = map[k];
    if (prev != null) {
      final newStatus = _normalizeStatus(item.status);
      final oldStatus = _normalizeStatus(prev.status);

      // bloqueia downgrade de status
      if (_statusRank(newStatus) < _statusRank(oldStatus)) {
        item = item.copyWith(status: oldStatus);
      } else {
        item = item.copyWith(status: newStatus);
      }

      // preserva assignedTo se o novo vier vazio
      final newAssigned = (item.assignedTo ?? '').trim();
      final oldAssigned = (prev.assignedTo ?? '').trim();
      if (newAssigned.isEmpty && oldAssigned.isNotEmpty) {
        item = item.copyWith(assignedTo: oldAssigned);
      }
    } else {
      item = item.copyWith(status: _normalizeStatus(item.status));
    }

    map[k] = item;
    state = map.values.toList();
  }

  void _patchStatus({
    required String id,
    required MapItemType type,
    required String status,
    String? assignedTo,
  }) {
    final idx = state.indexWhere((x) => x.type == type && x.id == id);
    if (idx == -1) return;

    final old = state[idx];

    final incomingNorm = _normalizeStatus(status);
    final oldNorm = _normalizeStatus(old.status);

    // bloqueia downgrade
    if (_statusRank(incomingNorm) < _statusRank(oldNorm)) {
      return;
    }

    final patched = old.copyWith(
      status: incomingNorm,
      assignedTo: assignedTo ?? old.assignedTo,
    );

    final copy = [...state];
    copy[idx] = patched;
    state = copy;
  }

  String _key(MapItemType t, String id) => '${t.name}::$id';

  MapItem _maybeExisting(MapItemType type, String id) {
    return state.firstWhere(
      (x) => x.type == type && x.id == id,
      orElse: () => MapItem(
        id: id,
        type: type,
        title: type == MapItemType.bin ? 'Bin alert' : 'Incident',
        subtitle: 'Localização desconhecida',
        position: const LatLng(41.1618799, -8.5838921),
        priority: MapPriority.medium,
        status: 'open',
        assignedTo: null,
        createdAt: null,
      ),
    );
  }

  // -----------------------------
  // DTO -> MapItem (CORRIGIDOS)
  // -----------------------------

  MapItem? _incidentToMapItem(Map<String, dynamic> m) {
    final id = (m['id'] ??
            m['incident_id'] ??
            m['incidentId'] ??
            m['event_id'] ??
            m['sos_id'] ??
            m['sosId'] ??
            '')
        .toString();
    if (id.trim().isEmpty) return null;

    final incidentType =
        (m['incident_type'] ?? m['type'] ?? m['kind'] ?? 'Incident').toString();

    final status = _normalizeStatus((m['status'] ?? 'active').toString());

    String? assignedTo;
    final meta = m['incident_metadata'] ?? m['incidentMetadata'];
    if (meta is Map) {
      final mm = Map<String, dynamic>.from(meta);
      assignedTo = (mm['assigned_to'] ?? mm['assignedTo'])?.toString();
    }
    assignedTo ??=
        (m['assignedTo'] ?? m['assigned_to'] ?? m['staffId'])?.toString();

    final locationNode =
        (m['location_node'] ?? m['locationNode'] ?? m['node'])?.toString();

    final pos = _extractLatLng(m) ?? const LatLng(41.1618799, -8.5838921);

    final title = _nonEmpty(
          (m['title'] ?? m['name'])?.toString(),
          fallback: _prettyIncidentTitle(incidentType),
        ) ??
        _prettyIncidentTitle(incidentType);

    final subtitle = _nonEmpty(
      (m['location_description'] ??
              m['location'] ??
              m['area'] ??
              m['zone'] ??
              m['description'])
          ?.toString(),
      fallback: 'Localização desconhecida',
    )!;

    final priority = _parsePriority(m['priority'] ?? m['severity'] ?? m['level']);
    final createdAt = _parseDateTime(m['createdAt'] ?? m['timestamp']);

    return MapItem(
      id: id,
      type: MapItemType.incident,
      title: title,
      subtitle: subtitle,
      position: pos,
      priority: priority,
      status: status,
      assignedTo: assignedTo,
      createdAt: createdAt,
      locationNode: locationNode,
    );
  }

  MapItem? _binAlertToMapItem(Map<String, dynamic> m) {
    final id = (m['task_id'] ?? m['taskId'] ?? m['bin_id'] ?? m['binId'] ?? m['id'] ?? '')
        .toString();
    if (id.trim().isEmpty) return null;

    final status = _normalizeStatus((m['status'] ?? 'open').toString());
    final assignedTo =
        (m['assignedTo'] ?? m['assigned_to'] ?? m['staffId'] ?? m['staff_id'])
            ?.toString();

    final locationNode =
        (m['location_node'] ?? m['locationNode'] ?? m['node'] ?? m['poi_node'])
            ?.toString();

    final pos = _extractLatLng(m) ?? const LatLng(41.1618799, -8.5838921);

    final fill = m['fill_percentage'] ?? m['fill'] ?? m['percent'];
    final binId = (m['bin_id'] ?? m['binId'] ?? '').toString();
    final title = _nonEmpty(
          (m['title'] ?? m['name'])?.toString(),
          fallback: (binId.isNotEmpty && fill != null)
              ? 'Bin $binId (${fill.toString()}%)'
              : (binId.isNotEmpty ? 'Bin $binId' : 'Bin cheio'),
        ) ??
        'Bin cheio';

    final subtitle = _nonEmpty(
          (m['location'] ??
                  m['area'] ??
                  m['zone'] ??
                  m['corridor'] ??
                  m['description'])
              ?.toString(),
          fallback: 'Localização desconhecida',
        ) ??
        'Localização desconhecida';

    final priority = _parsePriority(m['priority'] ?? m['level'] ?? m['severity']);
    final createdAt = _parseDateTime(m['createdAt'] ?? m['timestamp']);

    return MapItem(
      id: id,
      type: MapItemType.bin,
      title: title,
      subtitle: subtitle,
      position: pos,
      priority: priority,
      status: status,
      assignedTo: assignedTo,
      createdAt: createdAt,
      locationNode: locationNode,
    );
  }

  // -----------------------------
  // Networking helpers
  // -----------------------------

  Dio _dioForService({required int port}) {
    final settings = ref.read(settingsStoreProvider).valueOrNull;
    final authBase = settings?.authBaseUrl ?? 'http://10.0.2.2:8081';
    final baseUrl = withPort(authBase, port);

    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 6),
        receiveTimeout: const Duration(seconds: 12),
        sendTimeout: const Duration(seconds: 12),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    final token = ref.read(currentTokenProvider);
    if (token != null && token.trim().isNotEmpty) {
      dio.options.headers['Authorization'] = 'Bearer $token';
    }

    return dio;
  }

  // -----------------------------
  // Parsing helpers
  // -----------------------------

  List<dynamic> _extractList(dynamic data, {required List<String> keys}) {
    if (data is List) return data;
    if (data is Map) {
      final map = Map<String, dynamic>.from(data as Map);
      for (final k in keys) {
        final v = map[k];
        if (v is List) return v;
      }
    }
    return const [];
  }

  LatLng? _extractLatLng(Map<String, dynamic> m) {
    double? lat;
    double? lng;

    void tryRead(dynamic a, dynamic b) {
      final la = _toDouble(a);
      final lo = _toDouble(b);
      if (la != null && lo != null) {
        lat = la;
        lng = lo;
      }
    }

    tryRead(m['lat'] ?? m['latitude'], m['lng'] ?? m['lon'] ?? m['longitude']);

    final pos = m['position'];
    if (lat == null && lng == null && pos is Map) {
      final mm = Map<String, dynamic>.from(pos);
      tryRead(mm['lat'] ?? mm['latitude'], mm['lng'] ?? mm['lon'] ?? mm['longitude']);
    }

    final loc = m['location'];
    if (lat == null && lng == null && loc is Map) {
      final mm = Map<String, dynamic>.from(loc);
      tryRead(mm['lat'] ?? mm['latitude'], mm['lng'] ?? mm['lon'] ?? mm['longitude']);
    }

    final coords = m['coordinates'];
    if (lat == null && lng == null && coords is List && coords.length >= 2) {
      final lo = _toDouble(coords[0]);
      final la = _toDouble(coords[1]);
      if (la != null && lo != null) {
        lat = la;
        lng = lo;
      }
    }

    if (lat == null || lng == null) return null;
    return LatLng(lat!, lng!);
  }

  double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  MapPriority _parsePriority(dynamic v) {
    if (v == null) return MapPriority.medium;
    final s = v.toString().trim().toLowerCase();
    if (s.isEmpty) return MapPriority.medium;

    if (s.contains('critical') || s.contains('critico') || s == 'red') {
      return MapPriority.critical;
    }
    if (s.contains('high') || s.contains('alto') || s == 'orange') {
      return MapPriority.high;
    }
    if (s.contains('medium') || s.contains('medio') || s == 'yellow') {
      return MapPriority.medium;
    }
    if (s.contains('low') || s.contains('baixo') || s == 'green') {
      return MapPriority.low;
    }

    final n = int.tryParse(s);
    if (n != null) {
      if (n >= 4) return MapPriority.critical;
      if (n == 3) return MapPriority.high;
      if (n == 2) return MapPriority.medium;
      return MapPriority.low;
    }

    return MapPriority.medium;
  }

  int _statusRank(String normalized) {
    switch (normalized) {
      case 'open':
        return 1;
      case 'assigned': // includes investigating
        return 2;
      case 'in_progress': // includes responding
        return 3;
      case 'resolved':
        return 4;
      default:
        return 0;
    }
  }

  String _normalizeStatus(String v) {
    final s = v.trim().toLowerCase();
    if (s.isEmpty) return 'open';

    // OPEN
    if (s == 'open' ||
        s == 'opened' ||
        s == 'pending' ||
        s == 'unassigned' ||
        s == 'active') {
      return 'open';
    }

    // ASSIGNED
    if (s == 'assigned' || s == 'accepted' || s == 'investigating') {
      return 'assigned';
    }

    // IN PROGRESS
    if (s == 'in_progress' ||
        s == 'in progress' ||
        s == 'inprogress' ||
        s == 'responding' ||
        s == 'contained') {
      return 'in_progress';
    }

    // RESOLVED
    if (s == 'resolved' ||
        s == 'closed' ||
        s == 'done' ||
        s == 'complete' ||
        s == 'completed') {
      return 'resolved';
    }

    return s;
  }

  DateTime? _parseDateTime(dynamic v) {
    if (v == null) return null;
    if (v is int) {
      if (v > 1000000000000) return DateTime.fromMillisecondsSinceEpoch(v);
      if (v > 1000000000) return DateTime.fromMillisecondsSinceEpoch(v * 1000);
    }
    final s = v.toString().trim();
    if (s.isEmpty) return null;
    return DateTime.tryParse(s);
  }

  String? _nonEmpty(String? value, {required String fallback}) {
    final v = (value ?? '').trim();
    return v.isEmpty ? fallback : v;
  }

  String _prettyIncidentTitle(String type) {
    final t = type.trim();
    if (t.isEmpty) return 'Incidente';
    if (t.toLowerCase().contains('medical')) return 'Emergência médica';
    if (t.toLowerCase().contains('sos')) return 'SOS';
    if (t.toLowerCase().contains('aggress')) return 'Agressão';
    return 'Incidente • $t';
  }

  int _priorityRank(MapPriority p) {
    return switch (p) {
      MapPriority.low => 1,
      MapPriority.medium => 2,
      MapPriority.high => 3,
      MapPriority.critical => 4,
    };
  }
}
