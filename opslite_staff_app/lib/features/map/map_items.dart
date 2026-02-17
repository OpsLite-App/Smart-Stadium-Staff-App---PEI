import 'package:latlong2/latlong.dart';

enum MapItemType { incident, bin }

enum MapPriority { low, medium, high, critical }

class MapItem {
  final String id;
  final MapItemType type;
  final String title;
  final String subtitle;
  final LatLng position;
  final MapPriority priority;

  /// "open", "assigned", "resolved", etc.
  /// (mantemos string para compatibilidade com o que já tens)
  final String status;

  final String? assignedTo;
  final String? locationNode;

  final DateTime? createdAt;

  const MapItem({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.position,
    required this.priority,
    required this.status,
    this.assignedTo,
    this.createdAt,
    this.locationNode,
  });


  bool get isOpen => status == 'open';
  bool get isAssigned => status == 'assigned';
  bool get isResolved => status == 'resolved';

  MapItem copyWith({
    String? title,
    String? subtitle,
    LatLng? position,
    MapPriority? priority,
    String? status,
    String? assignedTo,
    DateTime? createdAt,
    String? locationNode,
  }) {
    return MapItem(
      id: id,
      type: type,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      position: position ?? this.position,
      priority: priority ?? this.priority,
      status: status ?? this.status,
      assignedTo: assignedTo ?? this.assignedTo,
      createdAt: createdAt ?? this.createdAt,
      locationNode: locationNode ?? this.locationNode,
    );
  }
}
