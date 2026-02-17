import 'package:flutter_riverpod/flutter_riverpod.dart';

class MapLayersState {
  final bool heatmap;
  final bool bins;
  final bool incidents;
  final bool staff;

  const MapLayersState({
    required this.heatmap,
    required this.bins,
    required this.incidents,
    required this.staff,
  });

  MapLayersState copyWith({
    bool? heatmap,
    bool? bins,
    bool? incidents,
    bool? staff,
  }) {
    return MapLayersState(
      heatmap: heatmap ?? this.heatmap,
      bins: bins ?? this.bins,
      incidents: incidents ?? this.incidents,
      staff: staff ?? this.staff,
    );
  }
}

class MapLayersController extends Notifier<MapLayersState> {
  @override
  MapLayersState build() {
    // defaults (ajusta como quiseres)
    return const MapLayersState(
      heatmap: true,
      bins: true,
      incidents: true,
      staff: false,
    );
  }

  void toggleHeatmap() => state = state.copyWith(heatmap: !state.heatmap);
  void toggleBins() => state = state.copyWith(bins: !state.bins);
  void toggleIncidents() => state = state.copyWith(incidents: !state.incidents);
  void toggleStaff() => state = state.copyWith(staff: !state.staff);

  void setAll(bool enabled) {
    state = MapLayersState(
      heatmap: enabled,
      bins: enabled,
      incidents: enabled,
      staff: enabled,
    );
  }
}

final mapLayersProvider =
    NotifierProvider<MapLayersController, MapLayersState>(
  MapLayersController.new,
);
