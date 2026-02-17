import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../storage/settings_store.dart';
import '../auth/session.dart';

final staffListProvider =
    AsyncNotifierProvider<StaffListController, List<StaffMember>>(
  StaffListController.new,
);

class StaffListController extends AsyncNotifier<List<StaffMember>> {
  @override
  Future<List<StaffMember>> build() async {
    return _fetchStaff();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetchStaff);
  }

  Future<List<StaffMember>> _fetchStaff() async {
    final dio = _dioForAuth();
    final resp = await dio.get('/auth/staff');
    final data = resp.data;

    final List<dynamic> list;
    if (data is List) {
      list = data;
    } else if (data is Map) {
      final m = Map<String, dynamic>.from(data);
      list = (m['staff'] ?? m['data'] ?? m['items'] ?? const <dynamic>[])
          as List<dynamic>;
    } else {
      list = const <dynamic>[];
    }

    return list
        .whereType<Map>()
        .map((x) => StaffMember.fromJson(Map<String, dynamic>.from(x)))
        .where((s) => s.id.trim().isNotEmpty)
        .toList();
  }

  Dio _dioForAuth() {
    final settings = ref.read(settingsStoreProvider).valueOrNull;
    final authBase = settings?.authBaseUrl ?? 'http://10.0.2.2:8081';

    final dio = Dio(
      BaseOptions(
        baseUrl: authBase,
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

class StaffMember {
  final String id;
  final String name;
  final String role; // normalized: "security" | "cleaning" | "medic" | "supervisor"
  final String? location; // nodeId ("N1") ou alias ("Gate-1") ou "lat,lng"
  final bool? available;

  const StaffMember({
    required this.id,
    required this.name,
    required this.role,
    this.location,
    this.available,
  });

  factory StaffMember.fromJson(Map<String, dynamic> m) {
    final rawRole = (m['role'] ?? 'staff').toString();
    final role = rawRole.trim().toLowerCase();

    final status = (m['status'] ?? '').toString().trim().toLowerCase();

    bool? available;
    if (m['available'] is bool) {
      available = m['available'] as bool;
    } else if (status.isNotEmpty) {
      available = status == 'active';
    }

    final loc = (m['current_location'] ??
            m['location'] ??
            m['node'] ??
            m['node_id'] ??
            m['nodeId'])
        ?.toString();

    return StaffMember(
      id: (m['id'] ?? m['user_id'] ?? m['userId'] ?? '').toString(),
      name: (m['name'] ?? m['username'] ?? 'Staff').toString(),
      role: role,
      location: loc,
      available: available,
    );
  }
}
