import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/events/crowd_event.dart';
import '../domain/events/emergency_event.dart';
import '../domain/events/maintenance_event.dart';
import 'realtime_hub_provider.dart';

final crowdStreamProvider = StreamProvider<CrowdEvent>((ref) {
  return ref.read(realtimeHubProvider).crowd;
});

final maintenanceStreamProvider = StreamProvider<MaintenanceEvent>((ref) {
  return ref.read(realtimeHubProvider).maintenance;
});

final emergencyStreamProvider = StreamProvider<EmergencyEvent>((ref) {
  return ref.read(realtimeHubProvider).emergency;
});
