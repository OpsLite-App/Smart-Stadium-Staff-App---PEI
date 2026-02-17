import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'event_feed_controller.dart';
import '../domain/events/base_event.dart';

final eventFeedProvider =
    AutoDisposeNotifierProvider<EventFeedController, List<BaseEvent>>(
  EventFeedController.new,
);
