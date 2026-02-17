import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import '../auth/role.dart';
import 'chat_controller.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  String _room = 'security';
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  List<String> _roomsFor(Role role) {
    // igual ao demo antigo (podes ajustar)
    switch (role) {
      case Role.cleaning:
        return const ['cleaning', 'supervisor', 'security'];
      case Role.security:
        return const ['security', 'supervisor', 'cleaning'];
      case Role.medic:
        return const ['medic', 'security', 'supervisor'];
      case Role.supervisor:
        return const ['supervisor', 'security', 'cleaning'];
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final role = session?.role;

    if (session == null || role == null) {
      return const Center(child: Text('Sem sessão'));
    }

    final rooms = _roomsFor(role);

    // garante join inicial
    ref.read(chatControllerProvider.notifier).joinRoom(_room);

    final messagesByRoom = ref.watch(chatControllerProvider);
    final messages = messagesByRoom[_room] ?? const [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
        actions: [
          PopupMenuButton<String>(
            initialValue: _room,
            onSelected: (r) async {
              setState(() => _room = r);
              await ref.read(chatControllerProvider.notifier).joinRoom(r);
            },
            itemBuilder: (_) => rooms
                .map((r) => PopupMenuItem(value: r, child: Text('# $r')))
                .toList(),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Text(
              '# $_room',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              reverse: true,
              itemCount: messages.length,
              itemBuilder: (ctx, i) {
                final m = messages[messages.length - 1 - i];
                final mine = m.senderId == session.userId.toString();

                return Align(
                  alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    constraints: const BoxConstraints(maxWidth: 320),
                    decoration: BoxDecoration(
                      color: mine ? Colors.deepPurple.withOpacity(0.12) : Colors.black.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.black.withOpacity(0.06)),
                    ),
                    child: Column(
                      crossAxisAlignment:
                          mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.senderName.isEmpty ? m.senderId : m.senderName,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.black.withOpacity(0.55),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(m.text),
                        const SizedBox(height: 4),
                        Text(
                          '${m.ts.hour.toString().padLeft(2, '0')}:${m.ts.minute.toString().padLeft(2, '0')}',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.black.withOpacity(0.45),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          const Divider(height: 1),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      decoration: const InputDecoration(
                        hintText: 'Escreve uma mensagem...',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _send,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    _ctrl.clear();

    try {
      await ref.read(chatControllerProvider.notifier).send(_room, text);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro a enviar: $e')),
      );
    }
  }
}
