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

int _i(dynamic v) {
  if (v is num) return v.toInt();
  return int.tryParse('$v') ?? 0;
}

class CrowdEvent extends BaseEvent {
  CrowdEvent({
    required super.receivedAt,
    required super.raw,
    required this.gate,
    required this.level,
    required this.people,
  }) : super(type: EventType.crowd);

  final String gate;
  final String level;
  final int people;

  static CrowdEvent? tryParse(String raw) {
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;

      final gate = _s(m, ['gate_id', 'gate', 'area_id', 'node_id']);
      if (gate.isEmpty) return null;

      // heat_level pode vir direto ou dentro de metadata
      var level = _s(m, ['heat_level', 'level']);
      final meta = m['metadata'];
      if (level.isEmpty && meta is Map) {
        level = _s(Map<String, dynamic>.from(meta), ['heat_level', 'level']);
      }
      if (level.isEmpty) level = 'unknown';

      final people = _i(m['current_count'] ?? m['people'] ?? m['count']);

      return CrowdEvent(
        receivedAt: DateTime.now(),
        raw: raw,
        gate: gate,
        level: level,
        people: people,
      );
    } catch (_) {
      return null;
    }
  }
}
