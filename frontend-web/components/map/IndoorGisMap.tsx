'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api, mapCoordsToLatLng } from '@/lib/services/api';
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
  type PoiProperties,
  type RoomProperties,
  type RouteEdgeProperties,
  type VerticalTransitionProperties,
} from '@/lib/services/gisApi';

function getStaffIconHtml(role: string, name: string, status: string) {
  let color = '#475569'; // default slate-600
  let iconSvg = '';

  const normalizedRole = (role || '').toLowerCase();
  if (normalizedRole.includes('security')) {
    color = '#2563eb'; // blue
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    `;
  } else if (normalizedRole.includes('cleaning')) {
    color = '#16a34a'; // green
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </svg>
    `;
  } else if (normalizedRole.includes('supervisor')) {
    color = '#d97706'; // amber/orange
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    `;
  } else if (normalizedRole.includes('medical')) {
    color = '#db2777'; // pink/red
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    `;
  } else {
    iconSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>
      </svg>
    `;
  }

  const initial = name ? name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) : '';

  const pulseStyle = status === 'active' || status === 'patrol' || status === 'on_duty' 
    ? `animation: staffPulse 2s infinite;` 
    : '';

  return `
    <div style="
      background: white;
      border-radius: 50%;
      padding: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${color};
      border: 2.5px solid ${color};
      width: 32px;
      height: 32px;
      position: relative;
      box-sizing: border-box;
      ${pulseStyle}
    ">
      ${iconSvg}
      <span style="
        position: absolute;
        bottom: -4px;
        right: -4px;
        background: ${color};
        color: white;
        font-size: 7.5px;
        font-weight: 800;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      ">${initial}</span>
    </div>
  `;
}

interface IndoorGisMapProps {
  floorId: number;
  routeGeoJson?: GisFeatureCollection<RouteEdgeProperties> | null;
  routeAffected?: boolean;
  nodeSelectionMode?: 'source' | 'blocked' | null;
  selectedNodeIds?: string[];
  onNodeSelect?: (nodeId: string) => void;
  heightClassName?: string;
  showCameraControls?: boolean;
  showHeatmap?: boolean;
  showStaffMarkers?: boolean;
  staffFilterId?: string | number | null;
}

const coverageStyles: Record<CameraDensityLevel, { color: string; fillColor: string; fillOpacity: number }> = {
  normal: { color: '#10b981', fillColor: '#6ee7b7', fillOpacity: 0.18 },
  busy: { color: '#f59e0b', fillColor: '#fcd34d', fillOpacity: 0.25 },
  congested: { color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.34 },
  critical: { color: '#ef4444', fillColor: '#f87171', fillOpacity: 0.44 },
};

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

function getCombinedBounds(layers: import('leaflet').GeoJSON[]) {
  let combined: import('leaflet').LatLngBounds | null = null;

  layers.forEach((layer) => {
    if (layer.getLayers().length === 0) return;
    const bounds = layer.getBounds();
    if (!bounds.isValid()) return;
    combined = combined ? combined.extend(bounds) : bounds;
  });

  return combined;
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
  showHeatmap = false,
  showStaffMarkers = true,
  staffFilterId = null,
}: IndoorGisMapProps) {
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerGroupRef = useRef<import('leaflet').LayerGroup | null>(null);
  const lastFloorIdRef = useRef<number | null>(null);
  const lastRouteGeoJsonRef = useRef<any>(null);
  const hasFittedRef = useRef<boolean>(false);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const canViewBins = Boolean(user?.permissions?.canViewBins || (user?.role && ['Cleaning', 'Supervisor'].includes(user.role)));
  void showCameraControls;

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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 22
      }).addTo(map);

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
    const timer = setInterval(() => {
      setRefreshToken((prev) => prev + 1);
    }, 6000); // refresh every 6s to keep positions active
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const invalidate = () => {
      mapRef.current?.invalidateSize(false);
    };

    const animationFrame = requestAnimationFrame(invalidate);
    const timeout = window.setTimeout(invalidate, 250);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [mapReady, heightClassName]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const handlePopupOpen = (e: any) => {
      const popup = e.popup;
      const container = popup.getElement();
      if (!container) return;

      const btn = container.querySelector('.gis-empty-bin-btn');
      if (btn) {
        const taskId = btn.getAttribute('data-task-id');
        btn.addEventListener('click', async () => {
          btn.setAttribute('disabled', 'true');
          btn.style.background = '#94a3b8';
          btn.textContent = 'A esvaziar...';

          try {
            if (taskId) {
              await api.updateTaskStatus(taskId, 'completed');
              setRefreshToken((prev) => prev + 1);
              mapRef.current?.closePopup();
            }
          } catch (err) {
            console.error('[Indoor GIS Map] Failed to empty bin:', err);
            btn.removeAttribute('disabled');
            btn.style.background = '#ef4444';
            btn.textContent = 'Erro! Tentar de novo';
          }
        });
      }
    };

    mapRef.current.on('popupopen', handlePopupOpen);
    return () => {
      if (mapRef.current) {
        mapRef.current.off('popupopen', handlePopupOpen);
      }
    };
  }, [mapReady]);

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

        const [rooms, corridors, nodes, cameras, coverage, transitions, cameraStatusResponse, impactedEdges, pois, binAlerts, heatmapPointsRes, staffMembers, staffPositions] = await Promise.all([
          gisApi.getRooms({ floorId }),
          gisApi.getCorridors({ floorId }),
          gisApi.getNodes({ floorId }),
          gisApi.getCameras({ floorId }),
          gisApi.getCameraCoverage({ floorId }),
          gisApi.getVerticalTransitions({ floorId }),
          gisApi.getCameraStatus({ floorId }),
          gisApi.getImpactedEdges({ floorId }),
          gisApi.getPois({ floorId }),
          canViewBins ? api.getBinAlerts().catch(() => []) : Promise.resolve([]),
          showHeatmap ? api.getHeatmapPoints({ floorId }).catch(() => ({ points: [] })) : Promise.resolve({ points: [] }),
          api.getStaff().catch(() => []),
          api.getAllStaffPositions().catch(() => []),
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
            layer.bindTooltip(properties.room_name ?? properties.room_code ?? `Sala ${properties.id}`, {
              sticky: true,
            });
          },
        }).addTo(layerGroupRef.current);

        const cameraStatusLookup = buildCameraStatusLookup(cameraStatusResponse.statuses);

        if (showHeatmap) {
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

              if (status) {
                layer.bindPopup(`
                  <div style="font-family: inherit; min-width: 180px; padding: 4px;">
                    <strong style="display:block; margin-bottom:4px; color:#0f172a;">
                      ${status.camera_name ?? properties.monitored_area ?? `Camera ${status.camera_id}`}
                    </strong>
                    <div style="font-size:12px; color:#475569; line-height:1.55;">
                      <div><b>Área:</b> ${status.monitored_area ?? properties.monitored_area ?? 'Sem zona definida'}</div>
                      <div><b>Piso:</b> ${status.floor_id}</div>
                      <div><b>Pessoas:</b> ${status.people_count}</div>
                      <div><b>Densidade:</b> ${status.density_level}</div>
                      <div><b>Estado:</b> ${status.status}</div>
                    </div>
                  </div>
                `);
              } else {
                layer.bindPopup(`
                  <div style="font-family: inherit; min-width: 160px; padding: 4px;">
                    <strong style="display:block; margin-bottom:4px; color:#0f172a;">
                      ${properties.monitored_area ?? `Coverage ${properties.id}`}
                    </strong>
                    <div style="font-size:12px; color:#475569; line-height:1.55;">
                      <div><b>Piso:</b> ${properties.floor_id}</div>
                      <div><b>Câmara:</b> ${properties.camera_id ?? 'N/A'}</div>
                      <div>Sem estado operacional associado.</div>
                    </div>
                  </div>
                `);
              }
            },
          }).addTo(layerGroupRef.current);
        }

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

            layer.bindTooltip(`Aresta da rota ${properties.edge_id} · ${Math.round(properties.length)}m${impactText}`, {
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
            const density = status?.density_level || 'normal';
            const color = coverageStyles[density]?.color || '#64748b';

            const cameraHtml = `
              <div style="
                background: white;
                border-radius: 50%;
                padding: 4px;
                box-shadow: 0 3px 8px rgba(0,0,0,0.18);
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${color};
                border: 2px solid ${color};
                width: 26px;
                height: 26px;
                box-sizing: border-box;
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2 2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            `;

            return L.marker(latlng, {
              icon: L.divIcon({
                className: 'gis-camera-marker',
                html: cameraHtml,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              }),
            })
              .bindTooltip(properties.camera_name ?? `Camera ${properties.id}`, { sticky: true })
              .bindPopup(`
                <div style="font-family: inherit; min-width: 180px; padding: 4px;">
                  <strong style="display:block; margin-bottom:4px; color:#0f172a;">
                    ${properties.camera_name ?? `Camera ${properties.id}`}
                  </strong>
                  <div style="font-size:12px; color:#475569; line-height:1.55;">
                    <div><b>Piso:</b> ${properties.floor_id}</div>
                    <div><b>Estado:</b> ${status?.status ?? properties.status ?? 'N/A'}</div>
                    ${status ? `<div><b>Pessoas:</b> ${status.people_count}</div><div><b>Densidade:</b> ${status.density_level}</div>` : ''}
                  </div>
                </div>
              `)
              ;
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

        const poiLayer = canViewBins
          ? L.geoJSON(pois as unknown as GeoJSON.GeoJsonObject, {
            filter: (feature) => {
              const properties = feature?.properties as PoiProperties | undefined;
              if (!properties) return false;
              return properties.category === 'bin' || (properties.name ? properties.name.toLowerCase().includes('lixeira') : false);
            },
            pointToLayer: (feature, latlng) => {
              const properties = feature.properties as PoiProperties;
              
              const parseNodeId = (val: string | number | undefined | null): number | null => {
                if (val == null) return null;
                const str = String(val).trim().toUpperCase();
                const cleaned = str.replace(/^N/, '');
                const parsed = parseInt(cleaned, 10);
                return isNaN(parsed) ? null : parsed;
              };

              const poiNodeId = parseNodeId(properties.node_id);
              const activeAlerts = (binAlerts || []).filter(
                (alert: any) => alert.status !== 'completed' && alert.status !== 'cancelled' && !alert.completed_at
              );
              const alertForPoi = activeAlerts.find(
                (alert: any) => parseNodeId(alert.location_node) === poiNodeId
              );

              const fillPct = alertForPoi ? (alertForPoi.fill_percentage ?? 0) : 0;
              const isFull = !!alertForPoi && fillPct >= 100;
              const statusText = isFull ? `Cheio (${Math.round(fillPct)}%)` : (alertForPoi ? `Limpo (${Math.round(fillPct)}%)` : 'Vazio');
              const statusColor = isFull ? '#ef4444' : '#22c55e';
              
              const iconHtml = isFull 
                ? `<div class="gis-bin-full" style="background:white;border-radius:50%;padding:5px;box-shadow:0 4px 12px rgba(239,68,68,0.25);display:flex;align-items:center;justify-content:center;color:#ef4444;border:2px solid #ef4444;width:26px;height:26px;box-sizing:border-box;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></div>`
                : `<div style="background:white;border-radius:50%;padding:5px;box-shadow:0 2px 6px rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:center;color:#22c55e;border:2px solid #22c55e;width:26px;height:26px;box-sizing:border-box;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></div>`;

              const marker = L.marker(latlng, {
                icon: L.divIcon({
                  className: 'gis-poi-marker',
                  html: iconHtml,
                  iconSize: [26, 26],
                  iconAnchor: [13, 13],
                }),
              });

              let popupContent = `
                <div style="font-family: inherit; padding: 6px; min-width: 150px; text-align: center;">
                  <strong style="font-size: 13px; color: #1f2937; display: block; margin-bottom: 4px;">
                    ${properties.name ?? 'Caixote do lixo'}
                  </strong>
                  <span style="font-size: 11px; display: block; margin-bottom: 6px; color: #4b5563;">
                    Nó: ${properties.node_id ?? 'N/A'}
                  </span>
                  <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: ${statusColor};">
                      ${statusText}
                    </span>
                  </div>
              `;

              const canEmpty = isFull && user && ['Cleaning', 'Supervisor'].includes(user.role);
              if (canEmpty) {
                popupContent += `
                  <button 
                    class="gis-empty-bin-btn" 
                    data-task-id="${alertForPoi.id}"
                    style="
                      width: 100%;
                      background: #4f46e5;
                      color: white;
                      border: none;
                      padding: 6px 10px;
                      border-radius: 6px;
                      font-size: 11px;
                      font-weight: 600;
                      cursor: pointer;
                      text-align: center;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                      transition: background 0.15s;
                    "
                    onmouseover="this.style.background='#4338ca'"
                    onmouseout="this.style.background='#4f46e5'"
                  >
                    Esvaziar caixote do lixo
                  </button>
                `;
              }

              popupContent += `</div>`;

              marker.bindPopup(popupContent);
              marker.bindTooltip(`<strong>${properties.name ?? 'Caixote do lixo'}</strong><br/><span style="color:${statusColor};font-weight:bold;">${statusText}</span>`, { sticky: true });

              return marker;
            },
          }).addTo(layerGroupRef.current)
          : null;

        let heatmapLayer = null;
        if (showHeatmap && heatmapPointsRes?.points && heatmapPointsRes.points.length > 0) {
          try {
            await import('leaflet.heat');
            const points = heatmapPointsRes.points.map((p: any) => [p.latitude, p.longitude, p.weight]);
            // @ts-ignore
            heatmapLayer = L.heatLayer(points, {
              radius: 28,
              blur: 18,
              maxZoom: 18,
              max: 1.0,
              gradient: {
                0.3: '#3b82f6',
                0.55: '#10b981',
                0.75: '#eab308',
                1.0: '#ef4444'
              }
            }).addTo(layerGroupRef.current);
          } catch (e) {
            console.error('[Indoor GIS Map] Failed to load heatmap layer:', e);
          }
        }

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

        // Render staff member markers
        if (showStaffMarkers && staffMembers && staffMembers.length > 0) {
          const floorNodeIds = new Set(
            (nodes?.features || []).map((f: any) => String(f.properties?.node_id || f.properties?.id))
          );

          staffMembers
            .filter((member: any) => staffFilterId == null || String(member.id) === String(staffFilterId))
            .forEach((member: any) => {
            const pos = staffPositions.find((p: any) => String(p.staff_id) === String(member.id));
            if (!pos) return;

            const isCurrentFloor = floorNodeIds.has(String(pos.location_id)) ||
              (pos.zone && pos.zone.toLowerCase().includes(`floor ${floorId}`));

            if (isCurrentFloor && layerGroupRef.current) {
              let lat = pos.y;
              let lng = pos.x;
              if (Math.abs(lng) > 10) {
                const converted = mapCoordsToLatLng(pos.x, pos.y);
                lat = converted[0];
                lng = converted[1];
              }

              const statusEmoji = member.status === 'active' ? '🟢 Active' : member.status === 'patrol' ? '🔵 Patrol' : '⚪ Break';
              const tooltipHtml = `
                <div style="font-family:inherit;padding:2px;">
                  <strong style="font-size:12px;color:#1e293b;">${member.name}</strong><br/>
                  <span style="font-size:10.5px;color:#64748b;font-weight:600;">${member.role}</span><br/>
                  <span style="font-size:10px;margin-top:2px;display:inline-block;">Estado: ${statusEmoji}</span>
                </div>
              `;

              L.marker([lat, lng], {
                icon: L.divIcon({
                  className: 'gis-staff-marker',
                  html: getStaffIconHtml(member.role, member.name, member.status),
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                }),
                zIndexOffset: 850,
              })
              .bindTooltip(tooltipHtml, { sticky: true })
              .addTo(layerGroupRef.current);
            }
          });
        }

        const isNewFloor = lastFloorIdRef.current !== floorId;
        const isNewRoute = lastRouteGeoJsonRef.current !== routeGeoJson;

        if (isNewFloor || isNewRoute) {
          hasFittedRef.current = false;
          lastFloorIdRef.current = floorId;
          lastRouteGeoJsonRef.current = routeGeoJson;
        }

        if (!hasFittedRef.current) {
          const bounds = nodeSelectionMode
            ? getCombinedBounds([roomLayer, corridorLayer, transitionLayer, ...(nodeLayer ? [nodeLayer] : [])])
            : getBestFitLayer(routeLayer, roomLayer, corridorLayer, cameraLayer, transitionLayer, ...(poiLayer ? [poiLayer] : []), ...(nodeLayer ? [nodeLayer] : []))?.getBounds();

          if (bounds?.isValid()) {
            mapRef.current.fitBounds(bounds.pad(nodeSelectionMode ? 0.28 : 0.12), { animate: false });
            hasFittedRef.current = true;
          }
        }

      } catch {
        setError('As camadas GIS não estão disponíveis. A apresentar a alternativa operacional abaixo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void renderLayers();

    return () => {
      cancelled = true;
    };
  }, [floorId, canViewBins, showHeatmap, showStaffMarkers, staffFilterId, mapReady, refreshToken, routeAffected, routeGeoJson, nodeSelectionMode, onNodeSelect, selectedNodeIds]);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50">
      <style>{`
        @keyframes staffPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
          }
        }
      `}</style>
      <div className={`relative bg-[linear-gradient(135deg,#f8fafc,#eef2f7)] ${heightClassName}`}>
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/65 text-sm font-medium text-slate-600 backdrop-blur-sm">
            A carregar camadas GIS...
          </div>
        )}
        {error && (
          <div className="absolute left-4 top-4 z-[500] max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
