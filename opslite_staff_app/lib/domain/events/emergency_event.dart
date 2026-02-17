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

class EmergencyEvent extends BaseEvent {
  EmergencyEvent({
    required super.receivedAt,
    required super.raw,
    required this.id,
    required this.kind,
    required this.status,
  }) : super(type: EventType.emergency);

  final String id;
  final String kind;
  final String status;

  static EmergencyEvent? tryParse(String raw) {
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;

      final id = _s(m, ['id', 'incident_id', 'event_id', 'sos_id', 'sosId']);
      if (id.isEmpty) return null;

      final kind = _s(m, ['incident_type', 'type', 'kind', 'event_type']);
      final status = _s(m, ['status', 'state']);

      return EmergencyEvent(
        receivedAt: DateTime.now(),
        raw: raw,
        id: id,
        kind: kind.isEmpty ? 'unknown' : kind,
        status: status.isEmpty ? 'active' : status,
      );
    } catch (_) {
      return null;
    }
  }
}
