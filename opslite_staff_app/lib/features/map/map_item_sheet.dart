import 'package:flutter/material.dart';
import 'map_items.dart';

class MapItemSheet extends StatelessWidget {
  const MapItemSheet({
    super.key,
    required this.item,
    required this.myStaffId,
    required this.onRoute,
    required this.onAccept,
    required this.onStart,
    required this.onComplete,
    required this.onChat,
  });

  final MapItem item;
  final String? myStaffId;
  final VoidCallback onRoute;
  final VoidCallback onAccept;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    final icon =
        item.type == MapItemType.incident ? Icons.warning_amber : Icons.delete_outline;

    final priorityLabel = switch (item.priority) {
      MapPriority.low => 'Baixa',
      MapPriority.medium => 'Média',
      MapPriority.high => 'Alta',
      MapPriority.critical => 'Crítica',
    };

    final statusLabel = _prettyStatus(item.status);
    final canAccept = item.status == 'open';

    final assigned = (item.assignedTo ?? '').trim();
    final mine = (myStaffId ?? '').trim();

    final isMine = assigned.isNotEmpty && mine.isNotEmpty && assigned == mine;


    final canStart = item.status == 'assigned' && isMine;
    final canComplete = item.status == 'in_progress' && isMine;


    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                CircleAvatar(child: Icon(icon)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(item.subtitle, style: const TextStyle(color: Colors.black54)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _Pill(text: 'Status: $statusLabel'),
                          const SizedBox(width: 8),
                          _Pill(text: 'Prioridade: $priorityLabel'),
                        ],
                      ),
                      if (item.assignedTo != null && item.assignedTo!.trim().isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Atribuído a: ${item.assignedTo}',
                          style: const TextStyle(color: Colors.black54),
                        ),
                        if (item.status != 'open' && !isMine)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              'Esta tarefa está atribuída a outro utilizador.',
                              style: TextStyle(color: Colors.redAccent),
                            ),
                          ),
                      ],

                      
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onRoute,
                    icon: const Icon(Icons.route),
                    label: const Text('Rota'),
                  ),
                ),
                const SizedBox(width: 12),

                // OPEN -> Aceitar
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canAccept ? onAccept : null,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Aceitar'),
                  ),
                ),
                const SizedBox(width: 12),

                // ASSIGNED (mine) -> Start
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canStart ? onStart : null,
                    icon: const Icon(Icons.play_circle_outline),
                    label: const Text('Start'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canComplete ? onComplete : null,
                    icon: const Icon(Icons.task_alt),
                    label: const Text('Complete'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onChat,
                    icon: const Icon(Icons.chat_bubble_outline),
                    label: const Text('Chat'),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  String _prettyStatus(String s) {
    final v = s.trim().toLowerCase();
    if (v == 'open') return 'Aberto';
    if (v == 'assigned') return 'Atribuído';
    if (v == 'in_progress') return 'Em progresso';
    if (v == 'resolved') return 'Resolvido';
    return s;
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black12,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600)),
    );
  }
}
