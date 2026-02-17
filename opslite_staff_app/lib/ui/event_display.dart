import 'package:flutter/material.dart';

import '../domain/events/base_event.dart';
import '../domain/events/crowd_event.dart';
import '../domain/events/emergency_event.dart';
import '../domain/events/maintenance_event.dart';
import '../domain/events/event_type.dart';

class EventDisplay {
  EventDisplay({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;
}

EventDisplay displayFor(BaseEvent e) {
  switch (e.type) {
    case EventType.crowd:
      final c = e as CrowdEvent;
      return EventDisplay(
        title: 'Crowd — Gate ${c.gate}',
        subtitle: '${c.level} • ${c.people} pessoas',
        icon: Icons.groups,
      );

    case EventType.maintenance:
      final m = e as MaintenanceEvent;
      return EventDisplay(
        title: 'Maintenance — Bin ${m.binId}',
        subtitle: 'Estado: ${m.status}',
        icon: Icons.delete_outline,
      );

    case EventType.emergency:
      final em = e as EmergencyEvent;
      return EventDisplay(
        title: 'Emergency — SOS ${em.id}',
        subtitle: '${em.kind} • ${em.status}',
        icon: Icons.warning_amber,
      );

    case EventType.unknown:
    default:
      return EventDisplay(
        title: 'Event',
        subtitle: e.raw,
        icon: Icons.notifications,
      );
  }
}
