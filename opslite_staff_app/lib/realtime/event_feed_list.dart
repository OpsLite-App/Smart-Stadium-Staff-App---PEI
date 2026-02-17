import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/events/base_event.dart';
import 'event_feed_provider.dart';
import '../ui/event_display.dart';

class EventFeedList extends ConsumerWidget {
  const EventFeedList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(eventFeedProvider);

    if (feed.isEmpty) {
      return const Text('Sem eventos ainda...');
    }

    return ListView.separated(
      shrinkWrap: true, 
      physics: const NeverScrollableScrollPhysics(),
      itemCount: feed.length,
      separatorBuilder: (_, __) => const SizedBox(height: 6),
      itemBuilder: (context, index) {
        return _EventTile(event: feed[index]);
      },
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});

  final BaseEvent event;

  @override
  Widget build(BuildContext context) {
    final d = displayFor(event);

    final time =
        '${event.receivedAt.hour.toString().padLeft(2, '0')}:'
        '${event.receivedAt.minute.toString().padLeft(2, '0')}';

    return Card(
      elevation: 1,
      child: ListTile(
        leading: Icon(
          d.icon,
          color: _iconColor(d.icon),
        ),
        title: Text(d.title),
        subtitle: Text(d.subtitle),
        trailing: Text(
          time,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }

  Color _iconColor(IconData icon) {
    if (icon == Icons.warning_amber) return Colors.red;
    if (icon == Icons.groups) return Colors.blue;
    if (icon == Icons.delete_outline) return Colors.brown;
    return Colors.grey;
  }
}
