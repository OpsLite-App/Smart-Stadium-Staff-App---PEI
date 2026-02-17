import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/events/base_event.dart';
import '../domain/events/crowd_event.dart';
import '../domain/events/emergency_event.dart';
import '../domain/events/maintenance_event.dart';
import 'realtime_hub_provider.dart';


class EventFeedController extends AutoDisposeNotifier<List<BaseEvent>> {
  static const int maxItems = 50;

  StreamSubscription? _s1;
  StreamSubscription? _s2;
  StreamSubscription? _s3;

  @override
  List<BaseEvent> build() {
    state = const [];

    final hub = ref.read(realtimeHubProvider);

    _s1 = hub.crowd.listen(_push);
    _s2 = hub.maintenance.listen(_push);
    _s3 = hub.emergency.listen(_push);

    ref.onDispose(() async {
      await _s1?.cancel();
      await _s2?.cancel();
      await _s3?.cancel();
    });

    return state;
  }

  void _push(BaseEvent e) {
    final next = [e, ...state];
    state = next.length > maxItems ? next.sublist(0, maxItems) : next;
  }

  void clear() => state = const [];
}
