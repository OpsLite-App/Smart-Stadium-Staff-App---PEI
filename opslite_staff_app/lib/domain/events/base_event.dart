import 'event_type.dart';

abstract class BaseEvent {
  BaseEvent({
    required this.type,
    required this.receivedAt,
    required this.raw,
  });

  final EventType type;
  final DateTime receivedAt;

  /// JSON string original (útil p/ debug e relatório)
  final String raw;
}
