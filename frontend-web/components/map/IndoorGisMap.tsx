'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import {
  gisApi,
  type CameraCoverageProperties,
  type CameraDensityLevel,
  type CameraProperties,
  type CameraStatus,
  type GisFeatureCollection,
  type ImpactedEdgeProperties,
  type RoomProperties,
  type RouteEdgeProperties,
  type VerticalTransitionProperties,
} from '@/lib/services/gisApi';

interface IndoorGisMapProps {
  floorId: number;
  routeGeoJson?: GisFeatureCollection<RouteEdgeProperties> | null;
  routeAffected?: boolean;
}

interface LayerStats {
  rooms: number;
  corridors: number;
  cameras: number;
  coverage: number;
  transitions: number;
  criticalAreas: number;
  impactedEdges: number;
}

const emptyStats: LayerStats = {
  rooms: 0,
  corridors: 0,
  cameras: 0,
  coverage: 0,
  transitions: 0,
  criticalAreas: 0,
  impactedEdges: 0,
};

const coverageStyles: Record<CameraDensityLevel, { color: string; fillColor: string; fillOpacity: number }> = {
  normal: { color: '#10b981', fillColor: '#6ee7b7', fillOpacity: 0.18 },
  busy: { color: '#f59e0b', fillColor: '#fcd34d', fillOpacity: 0.25 },
  congested: { color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.34 },
  critical: { color: '#ef4444', fillColor: '#f87171', fillOpacity: 0.44 },
};

const quickCameraActions: Array<{ level: CameraDensityLevel; label: string; peopleCount: number }> = [
  { level: 'normal', label: 'Normal', peopleCount: 12 },
  { level: 'busy', label: 'Busy', peopleCount: 29 },
  { level: 'congested', label: 'Congested', peopleCount: 46 },
  { level: 'critical', label: 'Critical', peopleCount: 65 },
];

function buildCameraStatusLookup(statuses: CameraStatus[]) {
  return {
    byCameraId: new Map(statuses.map((status) => [status.camera_id, status])),
    byCoverageId: new Map(
      statuses
        .filter((status) => status.coverage_id != null)
        .map((status) => [Number(status.coverage_id), status])
    ),
  };
}

function getCoverageStatus(
  properties: CameraCoverageProperties,
  lookup: ReturnType<typeof buildCameraStatusLookup>
) {
  if (properties.camera_id != null) {
    const byCamera = lookup.byCameraId.get(properties.camera_id);
    if (byCamera) return byCamera;
  }

  return lookup.byCoverageId.get(properties.id);
}

function getBestFitLayer(...layers: import('leaflet').GeoJSON[]) {
  return layers.find((layer) => layer.getLayers().length > 0);
}

export function IndoorGisMap({ floorId, routeGeoJson = null, routeAffected = false }: IndoorGisMapProps) {
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerGroupRef = useRef<import('leaflet').LayerGroup | null>(null);
  const selectedCameraIdRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LayerStats>(emptyStats);
  const [cameraStatuses, setCameraStatuses] = useState<CameraStatus[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraStatus | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [updatingLevel, setUpdatingLevel] = useState<CameraDensityLevel | null>(null);
  const isSupervisor = user?.role === 'Supervisor';

  const selectCamera = useCallback((status: CameraStatus) => {
    if (!isSupervisor) return;

    selectedCameraIdRef.current = status.camera_id;
    setSelectedCamera(status);
  }, [isSupervisor]);

  async function updateSelectedCamera(level: CameraDensityLevel, peopleCount: number) {
    if (!selectedCamera || !isSupervisor) return;

    setUpdatingLevel(level);
    setError(null);

    try {
      const updated = await gisApi.updateCameraStatus(selectedCamera.camera_id, {
        people_count: peopleCount,
        density_level: level,
        queue_level: level,
        status: 'online',
      });

      setSelectedCamera(updated);
      setCameraStatuses((current) =>
        current.map((status) => (status.camera_id === updated.camera_id ? updated : status))
      );
      setRefreshToken((value) => value + 1);
    } catch {
      setError('Could not update camera status.');
    } finally {
      setUpdatingLevel(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        minZoom: 17,
        maxZoom: 22,
      }).setView([40.6342, -8.65995], 20);

      L.control.attribution({ prefix: false }).addAttribution('Indoor GIS · PostGIS').addTo(map);

      const layers = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerGroupRef.current = layers;
      setMapReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    selectedCameraIdRef.current = null;
    setSelectedCamera(null);
  }, [floorId, isSupervisor]);

  useEffect(() => {
    let cancelled = false;

    async function renderLayers() {
      if (!mapReady) return;

      setLoading(true);
      setError(null);

      try {
        const leafletModule = await import('leaflet');
        const L = leafletModule.default;

        if (!mapRef.current || !layerGroupRef.current) return;

        const [rooms, corridors, cameras, coverage, transitions, cameraStatusResponse, impactedEdges] = await Promise.all([
          gisApi.getRooms({ floorId }),
          gisApi.getCorridors({ floorId }),
          gisApi.getCameras({ floorId }),
          gisApi.getCameraCoverage({ floorId }),
          gisApi.getVerticalTransitions({ floorId }),
          gisApi.getCameraStatus({ floorId }),
          gisApi.getImpactedEdges({ floorId }),
        ]);

        if (cancelled) return;

        layerGroupRef.current.clearLayers();

        const corridorLayer = L.geoJSON(corridors as unknown as GeoJSON.GeoJsonObject, {
          style: {
            color: '#64748b',
            weight: 1,
            fillColor: '#dbeafe',
            fillOpacity: 0.45,
          },
        }).addTo(layerGroupRef.current);

        const roomLayer = L.geoJSON(rooms as unknown as GeoJSON.GeoJsonObject, {
          style: (feature) => {
            const roomType = String((feature?.properties as RoomProperties | undefined)?.room_type ?? '');
            const isService = ['wc', 'cleaning', 'staff'].includes(roomType);
            const isLab = roomType === 'lab';

            return {
              color: isLab ? '#2563eb' : isService ? '#0f766e' : '#475569',
              weight: 1,
              fillColor: isLab ? '#bfdbfe' : isService ? '#ccfbf1' : '#f8fafc',
              fillOpacity: 0.78,
            };
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as RoomProperties;
            layer.bindTooltip(properties.room_name ?? properties.room_code ?? `Room ${properties.id}`, {
              sticky: true,
            });
          },
        }).addTo(layerGroupRef.current);

        const cameraStatusLookup = buildCameraStatusLookup(cameraStatusResponse.statuses);
        setCameraStatuses(cameraStatusResponse.statuses);

        if (selectedCameraIdRef.current != null) {
          setSelectedCamera(
            cameraStatusResponse.statuses.find((status) => status.camera_id === selectedCameraIdRef.current) ?? null
          );
        }

        L.geoJSON(coverage as unknown as GeoJSON.GeoJsonObject, {
          style: (feature) => {
            const properties = feature?.properties as CameraCoverageProperties | undefined;
            const status = properties ? getCoverageStatus(properties, cameraStatusLookup) : undefined;
            const style = coverageStyles[status?.density_level ?? 'normal'];

            return {
              color: style.color,
              weight: 1.5,
              fillColor: style.fillColor,
              fillOpacity: style.fillOpacity,
              dashArray: status?.density_level === 'critical' ? undefined : '4 4',
            };
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as CameraCoverageProperties;
            const status = getCoverageStatus(properties, cameraStatusLookup);
            const label = status
              ? `${status.camera_name ?? properties.monitored_area ?? `Coverage ${properties.id}`} · ${status.people_count} people · ${status.density_level}`
              : properties.monitored_area ?? `Camera coverage ${properties.id}`;

            layer.bindTooltip(label, {
              sticky: true,
            });

            if (status && isSupervisor) {
              layer.on('click', () => selectCamera(status));
            }
          },
        }).addTo(layerGroupRef.current);

        L.geoJSON(impactedEdges as unknown as GeoJSON.GeoJsonObject, {
          style: (feature) => {
            const properties = feature?.properties as ImpactedEdgeProperties | undefined;
            const isCritical = Number(properties?.cost_multiplier ?? 1) >= 7;

            return {
              color: isCritical ? '#dc2626' : '#ea580c',
              weight: isCritical ? 5 : 4,
              opacity: 0.96,
              dashArray: isCritical ? undefined : '8 6',
            };
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as ImpactedEdgeProperties;
            layer.bindTooltip(
              `Edge ${properties.edge_id} · x${properties.cost_multiplier} · ${properties.reason ?? properties.source}`,
              { sticky: true }
            );
          },
        }).addTo(layerGroupRef.current);

        const routeFeaturesForFloor = routeGeoJson
          ? {
              ...routeGeoJson,
              features: routeGeoJson.features.filter((feature) => feature.properties.floor_id === floorId),
            }
          : null;

        const routeLayer = L.geoJSON((routeFeaturesForFloor ?? { type: 'FeatureCollection', features: [] }) as unknown as GeoJSON.GeoJsonObject, {
          style: (feature) => {
            const properties = feature?.properties as RouteEdgeProperties | undefined;
            const isImpacted = Number(properties?.cost_multiplier ?? 1) > 1;

            return {
              color: routeAffected || isImpacted ? '#f97316' : '#2563eb',
              weight: 6,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            };
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as RouteEdgeProperties;
            const impactText =
              Number(properties.cost_multiplier ?? 1) > 1
                ? ` · impacted x${properties.cost_multiplier}`
                : '';

            layer.bindTooltip(`Route edge ${properties.edge_id} · ${Math.round(properties.length)}m${impactText}`, {
              sticky: true,
            });
          },
        }).addTo(layerGroupRef.current);

        const cameraLayer = L.geoJSON(cameras as unknown as GeoJSON.GeoJsonObject, {
          pointToLayer: (feature, latlng) => {
            const properties = feature.properties as CameraProperties;
            const status = cameraStatusLookup.byCameraId.get(properties.id);
            return L.marker(latlng, {
              icon: L.divIcon({
                className: 'gis-camera-marker',
                html: '<span class="gis-marker-dot gis-marker-dot-camera"></span>',
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              }),
            })
              .bindTooltip(properties.camera_name ?? `Camera ${properties.id}`, { sticky: true })
              .on('click', () => {
                if (status && isSupervisor) selectCamera(status);
              });
          },
        }).addTo(layerGroupRef.current);

        const transitionLayer = L.geoJSON(transitions as unknown as GeoJSON.GeoJsonObject, {
          pointToLayer: (feature, latlng) => {
            const properties = feature.properties as VerticalTransitionProperties;
            return L.marker(latlng, {
              icon: L.divIcon({
                className: 'gis-transition-marker',
                html: '<span class="gis-marker-dot gis-marker-dot-transition"></span>',
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              }),
            }).bindTooltip(properties.transition_name ?? properties.transition_type ?? `Transition ${properties.id}`, {
              sticky: true,
            });
          },
        }).addTo(layerGroupRef.current);

        const fitLayer = getBestFitLayer(routeLayer, roomLayer, corridorLayer, cameraLayer, transitionLayer);
        if (fitLayer) {
          const bounds = fitLayer.getBounds();
          if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds.pad(0.12), { animate: false });
          }
        }

        setStats({
          rooms: rooms.features.length,
          corridors: corridors.features.length,
          cameras: cameras.features.length,
          coverage: coverage.features.length,
          transitions: transitions.features.length,
          criticalAreas: cameraStatusResponse.statuses.filter((status) => status.density_level === 'critical').length,
          impactedEdges: impactedEdges.features.length,
        });
      } catch {
        setCameraStatuses([]);
        setSelectedCamera(null);
        setStats(emptyStats);
        setError('GIS layers unavailable. Showing operational fallback below.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void renderLayers();

    return () => {
      cancelled = true;
    };
  }, [floorId, isSupervisor, mapReady, refreshToken, routeAffected, routeGeoJson, selectCamera]);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">PostGIS layers</p>
          <p className="text-sm font-semibold text-slate-900">
            Floor {floorId} · {stats.rooms} rooms · {stats.cameras} cameras
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span>{stats.corridors} corridors</span>
          <span>{stats.coverage} coverage areas</span>
          <span>{stats.transitions} transitions</span>
          <span>{stats.impactedEdges} impacted edges</span>
          <span>{stats.criticalAreas} critical</span>
        </div>
      </div>

      <div className="relative h-[28rem] bg-[linear-gradient(135deg,#f8fafc,#eef2f7)]">
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/65 text-sm font-medium text-slate-600 backdrop-blur-sm">
            Loading GIS layers...
          </div>
        )}
        {error && (
          <div className="absolute left-4 top-4 z-[500] max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            {error}
          </div>
        )}
        {isSupervisor && (
        <div className="absolute right-4 top-4 z-[500] w-[20rem] max-w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-orange-600">
                Supervisor control
              </p>
              <h3 className="mt-1 text-sm font-bold text-slate-950">Camera operations</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-600">
              {cameraStatuses.length} live
            </span>
          </div>

          {selectedCamera ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-950">
                  {selectedCamera.camera_name ?? `Camera ${selectedCamera.camera_id}`}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Floor {selectedCamera.floor_id} · {selectedCamera.monitored_area ?? 'Unmapped coverage'}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-slate-500">People</p>
                    <p className="text-lg font-bold text-slate-950">{selectedCamera.people_count}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-slate-500">Density</p>
                    <p className="font-bold capitalize text-slate-950">{selectedCamera.density_level}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="text-slate-500">Status</p>
                    <p className="font-bold capitalize text-slate-950">{selectedCamera.status}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {quickCameraActions.map((action) => (
                  <button
                    key={action.level}
                    type="button"
                    disabled={updatingLevel != null}
                    onClick={() => void updateSelectedCamera(action.level, action.peopleCount)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: coverageStyles[action.level].color }}
                    />
                    {updatingLevel === action.level ? 'Updating...' : action.label}
                  </button>
                ))}
              </div>

              {['congested', 'critical'].includes(selectedCamera.density_level) && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-800">
                  Routing impact active: routes will avoid this monitored area when possible.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Select a camera or coverage area on the map to manage its live state.
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
