import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Índice do tab atual do AppShell.
/// 0 = Mapa (assumido em toda a app para deep-link interno)
final tabIndexProvider = StateProvider<int>((ref) => 0);
