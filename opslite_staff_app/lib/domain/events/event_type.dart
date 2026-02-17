enum EventType { crowd, maintenance, emergency, unknown }

EventType eventTypeFromTopic(String destination) {
  switch (destination) {
    case '/topic/crowd':
      return EventType.crowd;
    case '/topic/maintenance':
      return EventType.maintenance;
    case '/topic/emergency':
      return EventType.emergency;
    case '/topic/events':
      return EventType.unknown;
    default:
      return EventType.unknown;
  }
}
