import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import '../../storage/settings_store.dart';
import '../../realtime/realtime_hub_provider.dart';
import '../../realtime/emergency_snackbar_provider.dart';
import '../map/map_providers.dart';
import 'profile_providers.dart';
import '../map/map_items.dart';


class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _authBaseCtrl = TextEditingController();
  final _wsUrlCtrl = TextEditingController();

  @override
  void dispose() {
    _authBaseCtrl.dispose();
    _wsUrlCtrl.dispose();
    super.dispose();
  }

  void _toast(String msg) {
    ref.read(scaffoldMessengerKeyProvider).currentState?.showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    if (session == null) {
      return const Scaffold(body: Center(child: Text('Sem sessão.')));
    }

    final availability = ref.watch(availabilityProvider);
    final myNode = ref.watch(myNodeProvider);
    final assigned = ref.watch(myAssignedItemsProvider);

    final hub = ref.watch(realtimeHubProvider);
    final wsConnected = hub.isConnected;

    final settingsAsync = ref.watch(settingsStoreProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil'),
        actions: [
          IconButton(
            tooltip: 'Logout',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(sessionProvider.notifier).logout(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // -----------------------
          // Cartão do utilizador
          // -----------------------
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    child: Text(
                      (session.username.isNotEmpty ? session.username[0] : 'U')
                          .toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session.username,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text('Role: ${session.role.name}'),
                        Text('User ID: ${session.userId}'),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _StatusPill(
                              label: wsConnected ? 'WS Online' : 'WS Offline',
                              icon: wsConnected ? Icons.wifi : Icons.wifi_off,
                              tone: wsConnected ? _PillTone.good : _PillTone.bad,
                            ),
                            _StatusPill(
                              label: availability ? 'Disponível' : 'Ocupado',
                              icon: availability ? Icons.check_circle : Icons.do_not_disturb_on,
                              tone: availability ? _PillTone.good : _PillTone.warn,
                            ),
                            _StatusPill(
                              label: 'Node $myNode',
                              icon: Icons.place,
                              tone: _PillTone.neutral,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Copiar token (debug)',
                    icon: const Icon(Icons.copy),
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: session.token));
                      _toast('Token copiado');
                    },
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // -----------------------
          // O meu estado (operacional)
          // -----------------------
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'O meu estado',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Disponível'),
                    subtitle: Text(availability
                        ? 'Podes receber novas tasks/incidentes'
                        : 'Evita atribuições automáticas (modo ocupado)'),
                    value: availability,
                    onChanged: (v) => ref.read(availabilityProvider.notifier).state = v,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(
                            labelText: 'Localização (Node)',
                            hintText: 'Ex.: N12',
                            prefixIcon: Icon(Icons.place),
                          ),
                          controller: TextEditingController(text: myNode)
                            ..selection = TextSelection.collapsed(offset: myNode.length),
                          onChanged: (v) {
                            final node = v.trim().toUpperCase();
                            // não faz setState aqui, só guarda quando estiver minimamente válido
                            if (node.isNotEmpty) {
                              ref.read(myNodeProvider.notifier).state = node;
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton.tonal(
                        onPressed: () {
                          final node = ref.read(myNodeProvider).trim().toUpperCase();
                          if (!node.startsWith('N')) {
                            _toast('Node inválido (ex.: N12)');
                            return;
                          }
                          _toast('Localização atualizada: $node');
                        },
                        child: const Text('Atualizar'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // -----------------------
          // Minhas atribuições
          // -----------------------
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Minhas atribuições',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _KpiTile(
                          label: 'Atribuídos',
                          value: '${assigned.length}',
                          icon: Icons.assignment_turned_in,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _KpiTile(
                          label: 'Em progresso',
                          value: '${assigned.where((e) => e.status == 'in_progress').length}',
                          icon: Icons.play_circle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (assigned.isEmpty)
                    const Text('Sem itens atribuídos neste momento.')
                  else
                    ...assigned.take(5).map((it) => ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(it.type == MapItemType.incident
                              ? Icons.warning_amber
                              : Icons.delete_outline),
                          title: Text(it.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text('${it.status} • ${it.subtitle}',
                              maxLines: 1, overflow: TextOverflow.ellipsis),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () {
                            // se já tiveres um bottom sheet / detalhe, chama-o aqui
                            // ex: showModalBottomSheet(...)
                            _toast('Abrir detalhe: ${it.id}');
                          },
                        )),
                  if (assigned.length > 5)
                    Text(
                      '… e mais ${assigned.length - 5}',
                      style: TextStyle(color: Colors.black.withOpacity(0.6)),
                    ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // -----------------------
          // Ações rápidas
          // -----------------------
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Ações rápidas',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),

                  OutlinedButton.icon(
                    onPressed: () {
                      ref.read(assignedRouteProvider.notifier).state = null;
                      _toast('Rota limpa');
                    },
                    icon: const Icon(Icons.alt_route),
                    label: const Text('Limpar rota atual'),
                  ),
                  const SizedBox(height: 8),

                  OutlinedButton.icon(
                    onPressed: () async {
                      // reconectar WS (simples)
                      await hub.disconnect();
                      _toast('WS desligado (vai ligar automaticamente com sessão)');
                    },
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reiniciar realtime'),
                  ),
                  const SizedBox(height: 8),

                  FilledButton.tonalIcon(
                    onPressed: () => ref.read(sessionProvider.notifier).logout(),
                    icon: const Icon(Icons.logout),
                    label: const Text('Logout'),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // -----------------------
          // Avançado (endpoints)
          // -----------------------
          settingsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text('Erro a carregar settings: $e'),
            data: (settings) {
              // preencher inputs uma vez
              if (_authBaseCtrl.text.isEmpty) _authBaseCtrl.text = settings.authBaseUrl;
              if (_wsUrlCtrl.text.isEmpty) _wsUrlCtrl.text = settings.wsUrl;

              return ExpansionTile(
                tilePadding: const EdgeInsets.symmetric(horizontal: 8),
                title: const Text('Avançado'),
                subtitle: const Text('Endpoints e debug'),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: Column(
                      children: [
                        TextField(
                          controller: _authBaseCtrl,
                          decoration: const InputDecoration(
                            labelText: 'authBaseUrl',
                            prefixIcon: Icon(Icons.link),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _wsUrlCtrl,
                          decoration: const InputDecoration(
                            labelText: 'wsUrl',
                            prefixIcon: Icon(Icons.wifi),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton.icon(
                                onPressed: () async {
                                  final authBase = _authBaseCtrl.text.trim();
                                  final wsUrl = _wsUrlCtrl.text.trim();

                                  if (authBase.isEmpty || !authBase.startsWith('http')) {
                                    _toast('authBaseUrl inválido');
                                    return;
                                  }
                                  if (wsUrl.isEmpty || !wsUrl.startsWith('ws')) {
                                    _toast('wsUrl inválido');
                                    return;
                                  }

                                  final store = ref.read(settingsStoreProvider.notifier);
                                  await store.setAuthBaseUrl(authBase);
                                  await store.setWsUrl(wsUrl);

                                  _toast('Settings guardadas');
                                },
                                icon: const Icon(Icons.save),
                                label: const Text('Guardar'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () async {
                                  await ref.read(settingsStoreProvider.notifier).resetToDefaults();
                                  _authBaseCtrl.clear();
                                  _wsUrlCtrl.clear();
                                  _toast('Repostos defaults');
                                },
                                icon: const Icon(Icons.restart_alt),
                                label: const Text('Defaults'),
                              ),
                            ),
                          ],
                        ),
                        if (kDebugMode) ...[
                          const SizedBox(height: 10),
                          Text(
                            'Dica: se mudares endpoints, faz logout/login para garantir token + WS.',
                            style: TextStyle(color: Colors.black.withOpacity(0.6)),
                          ),
                        ]
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

enum _PillTone { good, warn, bad, neutral }

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.icon,
    required this.tone,
  });

  final String label;
  final IconData icon;
  final _PillTone tone;

  @override
  Widget build(BuildContext context) {
    Color border;
    Color bg;
    Color fg;

    switch (tone) {
      case _PillTone.good:
        border = Colors.green.withOpacity(0.35);
        bg = Colors.green.withOpacity(0.10);
        fg = Colors.green.shade800;
        break;
      case _PillTone.warn:
        border = Colors.orange.withOpacity(0.35);
        bg = Colors.orange.withOpacity(0.10);
        fg = Colors.orange.shade900;
        break;
      case _PillTone.bad:
        border = Colors.red.withOpacity(0.35);
        bg = Colors.red.withOpacity(0.10);
        fg = Colors.red.shade800;
        break;
      case _PillTone.neutral:
        border = Colors.black.withOpacity(0.15);
        bg = Colors.black.withOpacity(0.05);
        fg = Colors.black87;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
          ),
        ],
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.black.withOpacity(0.08)),
        color: Colors.black.withOpacity(0.03),
      ),
      child: Row(
        children: [
          Icon(icon),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              Text(label, style: TextStyle(color: Colors.black.withOpacity(0.6))),
            ],
          ),
        ],
      ),
    );
  }
}
