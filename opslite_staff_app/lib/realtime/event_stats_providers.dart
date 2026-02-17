import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/events/event_type.dart';
import 'event_feed_provider.dart';

final crowdCountProvider = Provider<int>((ref) {
  final feed = ref.watch(eventFeedProvider);
  return feed.where((e) => e.type == EventType.crowd).length;
});

final maintenanceCountProvider = Provider<int>((ref) {
  final feed = ref.watch(eventFeedProvider);
  return feed.where((e) => e.type == EventType.maintenance).length;
});

final emergencyCountProvider = Provider<int>((ref) {
  final feed = ref.watch(eventFeedProvider);
  return feed.where((e) => e.type == EventType.emergency).length;
});
