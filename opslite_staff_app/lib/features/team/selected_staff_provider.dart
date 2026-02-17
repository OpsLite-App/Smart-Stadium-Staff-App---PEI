import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'staff_provider.dart';

/// Staff selecionado na tab "Equipa" para focar no mapa.
final selectedStaffProvider = StateProvider<StaffMember?>((ref) => null);
