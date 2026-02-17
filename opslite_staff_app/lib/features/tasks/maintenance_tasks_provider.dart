import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../storage/settings_store.dart';
import '../auth/session.dart';
import '../../network/service_base_urls.dart';

final maintenanceTasksProvider =
    AsyncNotifierProvider<MaintenanceTasksController, List<MaintenanceTask>>(
  MaintenanceTasksController.new,
);

class MaintenanceTasksController extends AsyncNotifier<List<MaintenanceTask>> {
  @override
  Future<List<MaintenanceTask>> build() async {
    return _fetchTasks();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetchTasks);
  }

  Future<void> startTask(String taskId) async {
    final dio = _dioForMaintenance();
    await dio.post('/api/maintenance/tasks/$taskId/start');
    await refresh();
  }

  Future<void> completeTask(String taskId) async {
    final dio = _dioForMaintenance();
    await dio.post('/api/maintenance/tasks/$taskId/complete');
    await refresh();
  }

  Future<List<MaintenanceTask>> _fetchTasks() async {
    final dio = _dioForMaintenance();
    final resp = await dio.get('/api/maintenance/tasks');
    final data = resp.data;

    // Aceita List direta ou { tasks: [...] } ou { items: [...] } etc.
    final List<dynamic> list;
    if (data is List) {
      list = data;
    } else if (data is Map) {
      final m = Map<String, dynamic>.from(data);
      list = (m['tasks'] ??
              m['items'] ??
              m['data'] ??
              m['results'] ??
              const <dynamic>[]) as List<dynamic>;
    } else {
      list = const <dynamic>[];
    }

    return list
        .whereType<Map>()
        .map((x) => MaintenanceTask.fromJson(Map<String, dynamic>.from(x)))
        .toList();
  }

  Dio _dioForMaintenance() {
    final settings = ref.read(settingsStoreProvider).valueOrNull;

    // O settings geralmente guarda o host no authBaseUrl (10.0.2.2 vs localhost)
    final authBase = settings?.authBaseUrl ?? 'http://10.0.2.2:8081';
    final baseUrl = withPort(authBase, 8007);

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
}

enum TaskStatus { open, assigned, inProgress, completed, unknown }

class MaintenanceTask {
  final String id;
  final String title;
  final String description;
  final String? locationNode;
  final String? locationText;
  final TaskStatus status;
  final String? assignedTo;
  final DateTime? createdAt;

  const MaintenanceTask({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    this.locationNode,
    this.locationText,
    this.assignedTo,
    this.createdAt,
  });

  factory MaintenanceTask.fromJson(Map<String, dynamic> m) {
    final id = (m['id'] ?? m['task_id'] ?? m['taskId'] ?? '').toString();
    final title = (m['title'] ?? m['name'] ?? 'Task').toString();
    final description = (m['description'] ?? m['details'] ?? '').toString();

    final statusStr = (m['status'] ?? m['state'] ?? '').toString();
    final status = _parseStatus(statusStr);

    final locationNode =
        (m['location_node'] ?? m['locationNode'] ?? m['node_id'] ?? m['nodeId'])
            ?.toString();

    final locationText =
        (m['location'] ?? m['area'] ?? m['zone'] ?? m['poi'])?.toString();

    final assignedTo = (m['assigned_to'] ?? m['assignedTo'] ?? m['staff_id'])
        ?.toString();

    final createdAt = _parseDateTime(m['createdAt'] ?? m['timestamp']);

    return MaintenanceTask(
      id: id,
      title: title,
      description: description,
      status: status,
      locationNode: locationNode,
      locationText: locationText,
      assignedTo: assignedTo,
      createdAt: createdAt,
    );
  }

  static TaskStatus _parseStatus(String v) {
    final s = v.trim().toLowerCase();
    if (s.isEmpty) return TaskStatus.unknown;

    if (s == 'open' || s == 'new') return TaskStatus.open;
    if (s == 'assigned' || s == 'accepted') return TaskStatus.assigned;
    if (s == 'in_progress' || s == 'in progress' || s == 'started') {
      return TaskStatus.inProgress;
    }
    if (s == 'completed' || s == 'complete' || s == 'done' || s == 'resolved') {
      return TaskStatus.completed;
    }
    return TaskStatus.unknown;
  }

  static DateTime? _parseDateTime(dynamic v) {
    if (v == null) return null;
    if (v is int) {
      if (v > 1000000000000) return DateTime.fromMillisecondsSinceEpoch(v);
      if (v > 1000000000) return DateTime.fromMillisecondsSinceEpoch(v * 1000);
    }
    final s = v.toString().trim();
    if (s.isEmpty) return null;
    return DateTime.tryParse(s);
  }
}
