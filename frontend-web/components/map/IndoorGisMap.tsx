'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import {
  gisApi,
  type CameraCoverageProperties,
  type CameraDensityLevel,
  type CameraProperties,
  type CameraStatus,
  type GisFeature,
  type GisFeatureCollection,
  type ImpactedEdgeProperties,
  type NodeProperties,
  type RoomProperties,
  type RouteEdgeProperties,
  type VerticalTransitionProperties,
} from '@/lib/services/gisApi';

interface IndoorGisMapProps {
  floorId: number;
  routeGeoJson?: GisFeatureCollection<RouteEdgeProperties> | null;
  routeAffected?: boolean;
  nodeSelectionMode?: 'source' | 'blocked' | null;
  selectedNodeIds?: string[];
  onNodeSelect?: (nodeId: string) => void;
  heightClassName?: string;
  showCameraControls?: boolean;
}

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

const EMPTY_SELECTED_NODE_IDS: string[] = [];

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

type RouteEndpointKind = 'start' | 'end';

interface RouteEndpointMarker {
  kind: RouteEndpointKind;
  latLng: [number, number];
}

function getLineStringCoordinates(feature?: GisFeature<RouteEdgeProperties>) {
  if (!feature || feature.geometry.type !== 'LineString') return [];

  return (feature.geometry.coordinates as Array<[number, number]>).filter(
    ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)
  );
}

function featureFloorId(feature?: GisFeature<RouteEdgeProperties>) {
  return feature?.properties.floor_id ?? feature?.properties.current_floor_id ?? null;
}

function getRouteEndpointMarkers(
  routeGeoJson: GisFeatureCollection<RouteEdgeProperties> | null,
  floorId: number
): RouteEndpointMarker[] {
  const routeFeatures = routeGeoJson?.features.filter((feature) => feature.geometry.type === 'LineString') ?? [];
  const firstFeature = routeFeatures[0];
  const lastFeature = routeFeatures.at(-1);
  const markers: RouteEndpointMarker[] = [];

  if (featureFloorId(firstFeature) === floorId) {
    const coords = getLineStringCoordinates(firstFeature);
    const start = coords[0];
    if (start) markers.push({ kind: 'start', latLng: [start[1], start[0]] });
  }

  if (lastFeature && featureFloorId(lastFeature) === floorId) {
    const coords = getLineStringCoordinates(lastFeature);
    const end = coords.at(-1);
    if (end) markers.push({ kind: 'end', latLng: [end[1], end[0]] });
  }

  return markers;
}

function routeEndpointIconHtml(kind: RouteEndpointKind) {
  const isStart = kind === 'start';
  const background = isStart ? '#2563eb' : '#f97316';
  const label = isStart ? 'Partida' : 'Chegada';

  return `
    <span style="
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      background:${background};
      color:white;
      border:2px solid white;
      box-shadow:0 10px 24px rgba(15,23,42,0.22);
      font-size:11px;
      font-weight:800;
      line-height:1;
      white-space:nowrap;
    ">
      <span style="
        width:8px;
        height:8px;
        border-radius:999px;
        background:white;
        display:inline-block;
      "></span>
      ${label}
    </span>
  `;
}

function nodeMarkerHtml(nodeId: number, selected: boolean, mode?: 'source' | 'blocked' | null) {
  const background = selected ? (mode === 'source' ? '#dc2626' : '#f97316') : '#ffffff';
  const color = selected ? '#ffffff' : '#0f172a';
  const border = selected ? background : '#2563eb';

  return `
    <span style="
      min-width:24px;
      height:24px;
      padding:0 6px;
      border-radius:999px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      background:${background};
      color:${color};
      border:2px solid ${border};
      box-shadow:0 8px 18px rgba(15,23,42,0.22);
      font-size:10px;
      font-weight:900;
      line-height:1;
      cursor:pointer;
    ">${nodeId}</span>
  `;
}

export function IndoorGisMap({
  floorId,
  routeGeoJson = null,
  routeAffected = false,
  nodeSelectionMode = null,
  selectedNodeIds = EMPTY_SELECTED_NODE_IDS,
  onNodeSelect,
  heightClassName = 'h-[34rem] md:h-[38rem]',
  showCameraControls = true,
}: IndoorGisMapProps) {
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerGroupRef = useRef<import('leaflet').LayerGroup | null>(null);
  const selectedCameraIdRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatuses, setCameraStatuses] = useState<CameraStatus[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraStatus | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [updatingLevel, setUpdatingLevel] = useState<CameraDensityLevel | null>(null);
  const canManageCameraDensity = Boolean(user?.permissions.canManageCameraDensity);

  const selectCamera = useCallback((status: CameraStatus) => {
    if (!canManageCameraDensity) return;

    selectedCameraIdRef.current = status.camera_id;
    setSelectedCamera(status);
  }, [canManageCameraDensity]);

  async function updateSelectedCamera(level: CameraDensityLevel, peopleCount: number) {
    if (!selectedCamera || !canManageCameraDensity) return;

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
  }, [floorId, canManageCameraDensity]);

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

        const [rooms, corridors, nodes, cameras, coverage, transitions, cameraStatusResponse, impactedEdges] = await Promise.all([
          gisApi.getRooms({ floorId }),
          gisApi.getCorridors({ floorId }),
          gisApi.getNodes({ floorId }),
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

            if (status && canManageCameraDensity) {
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

        const layerGroup = layerGroupRef.current;
        getRouteEndpointMarkers(routeGeoJson, floorId).forEach((marker) => {
          const label = marker.kind === 'start' ? 'Ponto de partida' : 'Ponto de chegada';

          L.marker(marker.latLng, {
            zIndexOffset: 900,
            icon: L.divIcon({
              className: 'gis-route-endpoint-marker',
              html: routeEndpointIconHtml(marker.kind),
              iconSize: [86, 28],
              iconAnchor: [43, 14],
            }),
          })
            .bindTooltip(label, { sticky: true })
            .addTo(layerGroup);
        });

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
                if (status && canManageCameraDensity) selectCamera(status);
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

        const selectedNodeSet = new Set(selectedNodeIds.map(String));
        const nodeLayer = nodeSelectionMode
          ? L.geoJSON(nodes as unknown as GeoJSON.GeoJsonObject, {
              pointToLayer: (feature, latlng) => {
                const properties = feature.properties as NodeProperties;
                const selected = selectedNodeSet.has(String(properties.node_id));

                return L.marker(latlng, {
                  zIndexOffset: selected ? 1000 : 700,
                  icon: L.divIcon({
                    className: 'gis-node-selector-marker',
                    html: nodeMarkerHtml(properties.node_id, selected, nodeSelectionMode),
                    iconSize: [30, 24],
                    iconAnchor: [15, 12],
                  }),
                })
                  .bindTooltip(`Nó ${properties.node_id} · ${properties.type ?? 'graph node'}`, { sticky: true })
                  .on('click', () => onNodeSelect?.(String(properties.node_id)));
              },
            }).addTo(layerGroupRef.current)
          : null;

        const fitLayer = getBestFitLayer(routeLayer, roomLayer, corridorLayer, cameraLayer, transitionLayer, ...(nodeLayer ? [nodeLayer] : []));
        if (fitLayer) {
          const bounds = fitLayer.getBounds();
          if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds.pad(0.12), { animate: false });
          }
        }

      } catch {
        setCameraStatuses([]);
        setSelectedCamera(null);
        setError('GIS layers unavailable. Showing operational fallback below.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void renderLayers();

    return () => {
      cancelled = true;
    };
  }, [floorId, canManageCameraDensity, mapReady, refreshToken, routeAffected, routeGeoJson, selectCamera, nodeSelectionMode, onNodeSelect, selectedNodeIds]);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
      <div className={`relative bg-[linear-gradient(135deg,#f8fafc,#eef2f7)] ${heightClassName}`}>
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
        {showCameraControls && canManageCameraDensity && (
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
