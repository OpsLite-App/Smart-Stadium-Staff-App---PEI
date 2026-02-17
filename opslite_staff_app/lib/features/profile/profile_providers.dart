import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import '../map/map_items.dart';
import '../map/map_items_provider.dart';


/// Disponibilidade do operador (só UI por agora)
final availabilityProvider = StateProvider<bool>((ref) => true);

/// Localização atual do operador (NodeId). Podes reutilizar no SOS.
final myNodeProvider = StateProvider<String>((ref) => 'N1');

/// Lista de itens atribuídos ao utilizador logado (bins + incidentes)
final myAssignedItemsProvider = Provider<List<MapItem>>((ref) {
  final session = ref.watch(sessionProvider);
  final userId = session?.userId.toString();
  if (userId == null) return const [];

  final items = ref.watch(mapItemsProvider);
  return items.where((it) => (it.assignedTo ?? '').trim() == userId).toList();
});
