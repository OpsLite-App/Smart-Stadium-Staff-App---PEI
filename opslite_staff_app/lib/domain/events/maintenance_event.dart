import 'dart:convert';
import 'base_event.dart';
import 'event_type.dart';

String _s(Map<String, dynamic> m, List<String> keys) {
  for (final k in keys) {
    final v = m[k];
    if (v != null && v.toString().trim().isNotEmpty) return v.toString();
  }
  return '';
}

class MaintenanceEvent extends BaseEvent {
  MaintenanceEvent({
    required super.receivedAt,
    required super.raw,
    required this.binId,
    required this.status,
  }) : super(type: EventType.maintenance);

  final String binId;
  final String status;

  static MaintenanceEvent? tryParse(String raw) {
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;

      final id = _s(m, ['bin_id', 'binId', 'id', 'task_id', 'taskId']);
      if (id.isEmpty) return null;

      final status = _s(m, ['status', 'state']);

      return MaintenanceEvent(
        receivedAt: DateTime.now(),
        raw: raw,
        binId: id,
        status: status.isEmpty ? 'open' : status,
      );
    } catch (_) {
      return null;
    }
  }
}
