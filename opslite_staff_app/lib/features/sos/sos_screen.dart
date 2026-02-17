import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../map/map_items_provider.dart';
import '../../realtime/emergency_snackbar_provider.dart';
import 'sos_controller.dart';

class SosScreen extends ConsumerStatefulWidget {
  const SosScreen({super.key});

  @override
  ConsumerState<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends ConsumerState<SosScreen> {
  Timer? _timer;
  int _countdown = 0;

  String _incidentType = 'smoke';
  String _severity = 'critical';

  final _nodeCtrl = TextEditingController(text: 'N12');
  final _locDescCtrl = TextEditingController(text: 'Corredor 3 - Bancada Norte');
  final _descCtrl = TextEditingController(text: 'SOS acionado via app');

  @override
  void dispose() {
    _timer?.cancel();
    _nodeCtrl.dispose();
    _locDescCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _startCountdown() {
    if (_countdown > 0) return;

    // validações mínimas
    final node = _nodeCtrl.text.trim().toUpperCase();
    if (!node.startsWith('N')) {
      _toast('Node inválido (ex.: N12)');
      return;
    }
    if (_locDescCtrl.text.trim().isEmpty) {
      _toast('Preenche a descrição do local');
      return;
    }

    setState(() => _countdown = 3);
    _timer?.cancel();

    _timer = Timer.periodic(const Duration(seconds: 1), (t) async {
      if (!mounted) return;

      if (_countdown <= 1) {
        t.cancel();
        setState(() => _countdown = 0);
        await _triggerSos();
        return;
      }

      setState(() => _countdown -= 1);
    });
  }

  void _cancelCountdown() {
    _timer?.cancel();
    setState(() => _countdown = 0);
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

  Future<void> _triggerSos() async {
    final controller = ref.read(sosControllerProvider.notifier);

    final node = _nodeCtrl.text.trim().toUpperCase();
    final locDesc = _locDescCtrl.text.trim();
    final desc = _descCtrl.text.trim();

    try {
      final createdDto = await controller.createSosIncident(
        incidentType: _incidentType,
        severity: _severity,
        locationNode: node,
        locationDescription: locDesc,
        description: desc,
      );

      // inserir no mapa/lista imediatamente
      ref.read(mapItemsProvider.notifier).ingestIncidentDto(createdDto);

      _toast('🚨 SOS enviado! Incidente criado.');
    } catch (e) {
      _toast('❌ Falha ao enviar SOS: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final creating = ref.watch(sosControllerProvider).isLoading;

    return Scaffold(
      appBar: AppBar(title: const Text('SOS')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 8),
            const Icon(Icons.warning_amber_rounded, size: 64),
            const SizedBox(height: 12),
            const Text(
              'SOS / Emergência',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            const Text(
              'Configura os detalhes e ativa o SOS.\nSerá criado um incidente no Emergency Service.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),

            // FORM
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    DropdownButtonFormField<String>(
                      value: _incidentType,
                      decoration: const InputDecoration(
                        labelText: 'Tipo',
                        prefixIcon: Icon(Icons.category),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'smoke', child: Text('Smoke')),
                        DropdownMenuItem(value: 'fire', child: Text('Fire')),
                        DropdownMenuItem(value: 'gas_leak', child: Text('Gas leak')),
                        DropdownMenuItem(value: 'electrical', child: Text('Electrical')),
                        DropdownMenuItem(value: 'structural', child: Text('Structural')),
                      ],
                      onChanged: creating || _countdown > 0
                          ? null
                          : (v) => setState(() => _incidentType = v ?? 'smoke'),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _severity,
                      decoration: const InputDecoration(
                        labelText: 'Severidade',
                        prefixIcon: Icon(Icons.priority_high),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'critical', child: Text('Crítica')),
                        DropdownMenuItem(value: 'high', child: Text('Alta')),
                        DropdownMenuItem(value: 'medium', child: Text('Média')),
                        DropdownMenuItem(value: 'low', child: Text('Baixa')),
                      ],
                      onChanged: creating || _countdown > 0
                          ? null
                          : (v) => setState(() => _severity = v ?? 'critical'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _nodeCtrl,
                      enabled: !creating && _countdown == 0,
                      decoration: const InputDecoration(
                        labelText: 'Location node (ex.: N12)',
                        prefixIcon: Icon(Icons.place),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _locDescCtrl,
                      enabled: !creating && _countdown == 0,
                      decoration: const InputDecoration(
                        labelText: 'Descrição do local',
                        prefixIcon: Icon(Icons.map),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _descCtrl,
                      enabled: !creating && _countdown == 0,
                      decoration: const InputDecoration(
                        labelText: 'Descrição / notas',
                        prefixIcon: Icon(Icons.notes),
                      ),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Countdown “hero”
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 150,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: Colors.redAccent.withOpacity(0.10),
                border: Border.all(color: Colors.redAccent.withOpacity(0.25)),
              ),
              alignment: Alignment.center,
              child: creating
                  ? const CircularProgressIndicator()
                  : Text(
                      _countdown > 0 ? '$_countdown' : 'PRONTO',
                      style: const TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),

            const SizedBox(height: 16),

            if (_countdown == 0) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: creating ? null : _startCountdown,
                  icon: const Icon(Icons.sos),
                  label: const Text('Ativar SOS (3s)'),
                ),
              ),
            ] else ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: creating ? null : _cancelCountdown,
                  icon: const Icon(Icons.close),
                  label: const Text('Cancelar'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
