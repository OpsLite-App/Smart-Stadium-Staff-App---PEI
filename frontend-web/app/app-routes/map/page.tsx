'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { api, type HeatmapPoint, type StaffMember, MAINTENANCE_BASE } from '@/lib/services/api';
import axios from 'axios';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { Navigation, X } from 'lucide-react';

type BinPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

const DRAGAO_CENTER: L.LatLngTuple = [41.1618, -8.5839];

const DEFAULT_BINS: BinPoint[] = [
  { id: 'BIN-A1', name: 'Lixeira A1', lat: 41.16205, lng: -8.58425 },
  { id: 'BIN-B2', name: 'Lixeira B2', lat: 41.16155, lng: -8.58455 },
  { id: 'BIN-C3', name: 'Lixeira C3', lat: 41.1612, lng: -8.5837 },
  { id: 'BIN-D4', name: 'Lixeira D4', lat: 41.16145, lng: -8.5832 },
  { id: 'BIN-E5', name: 'Lixeira E5', lat: 41.16215, lng: -8.58345 },
];

// Node ID → lat/lng mapping (stadium graph nodes)
const NODE_COORDS: Record<string, L.LatLngTuple> = {
  N1:  [41.16180, -8.58390],
  N2:  [41.16200, -8.58420],
  N3:  [41.16160, -8.58440],
  N4:  [41.16130, -8.58410],
  N5:  [41.16140, -8.58350],
  N6:  [41.16170, -8.58320],
  N7:  [41.16210, -8.58350],
  N8:  [41.16220, -8.58390],
  N9:  [41.16190, -8.58460],
  N10: [41.16150, -8.58470],
};

function nodeToLatLng(nodeId: string, waypoints: { node_id: string; x: number; y: number }[]): L.LatLngTuple | null {
  // Try waypoints first (they have x/y from the graph)
  const wp = waypoints.find((w) => w.node_id === nodeId);
  if (wp && wp.x && wp.y) {
    // x/y are stadium-local coords — use NODE_COORDS as fallback
  }
  return NODE_COORDS[nodeId] ?? null;
}

const DEFAULT_HEATMAP: HeatmapPoint[] = [
  { latitude: 41.16195, longitude: -8.5842, weight: 0.9, heat_level: 'red' },
  { latitude: 41.16165, longitude: -8.58435, weight: 0.75, heat_level: 'yellow' },
  { latitude: 41.16135, longitude: -8.5841, weight: 0.6, heat_level: 'yellow' },
  { latitude: 41.1612, longitude: -8.5837, weight: 0.85, heat_level: 'red' },
  { latitude: 41.16145, longitude: -8.58335, weight: 0.65, heat_level: 'yellow' },
  { latitude: 41.1618, longitude: -8.5832, weight: 0.5, heat_level: 'green' },
  { latitude: 41.16205, longitude: -8.58355, weight: 0.45, heat_level: 'green' },
];

const BIN_ICON = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:6px;background:#fff;border:2px solid #065F46;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25);font-size:16px;">🗑️</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const MY_LOCATION_ICON = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#3B82F6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const NAVIGATING_ICON = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#3B82F6;border-radius:9999px;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function roleColor(role: string): string {
  const n = role.toLowerCase();
  if (n.includes('security')) return '#2563EB';
  if (n.includes('cleaning')) return '#10B981';
  if (n.includes('supervisor')) return '#F59E0B';
  return '#6B7280';
}

function roleIcon(role: string): string {
  const n = role.toLowerCase();
  if (n.includes('security')) return 'S';
  if (n.includes('cleaning')) return 'L';
  if (n.includes('supervisor')) return 'SV';
  return 'U';
}

export default function MapPage() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const staffLayerRef = useRef<L.LayerGroup | null>(null);
  const binsLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [usingFallbackHeatmap, setUsingFallbackHeatmap] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bins, setBins] = useState<BinPoint[]>(DEFAULT_BINS);
  const { user } = useAuthStore();
  const { active: activeNav, clearNavigation, currentNode } = useNavigationStore();

  // Detect sidebar open
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const overlay = document.querySelector('.fixed.inset-0.z-30.bg-gray-600');
      setSidebarOpen(!!overlay);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(DRAGAO_CENTER, 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

 // app/app-routes/map/page.tsx
// Localiza este useEffect (por volta da linha 140-160)

useEffect(() => {
  let mounted = true;
  const load = async () => {
    setLoading(true);
    try {
      const [staffData, heatData, binsData] = await Promise.all([
        api.getStaff().catch(() => []),
        api.getHeatmapPoints().catch(() => ({ points: [] as HeatmapPoint[] })),
        user?.permissions?.canViewBins 
          ? axios.get(`${MAINTENANCE_BASE}/bins/alerts`).then(r => r.data as { bin_id: string; location_node: string }[]).catch(() => [])
          : Promise.resolve([])
      ]);
      if (!mounted) return;
      setStaff(staffData);

      const seenBins = new Set<string>();
      const realBins: BinPoint[] = [];
      for (const b of binsData) {
        if (!seenBins.has(b.bin_id) && NODE_COORDS[b.location_node]) {
          seenBins.add(b.bin_id);
          const [lat, lng] = NODE_COORDS[b.location_node];
          realBins.push({ id: b.bin_id, name: `Lixeira ${b.bin_id}`, lat, lng });
        }
      }
      if (realBins.length > 0) setBins(realBins);
      const validPoints = (heatData.points || []).filter(
        (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.latitude !== 0 && p.longitude !== 0
      );
      if (validPoints.length >= 3) { setHeatmap(validPoints); setUsingFallbackHeatmap(false); }
      else { setHeatmap(DEFAULT_HEATMAP); setUsingFallbackHeatmap(true); }
    } finally {
      if (mounted) setLoading(false);
    }
  };
  load();
  const timer = setInterval(load, 30000);
  return () => { mounted = false; clearInterval(timer); };
}, [user?.permissions?.canViewBins]); 
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (binsLayerRef.current) map.removeLayer(binsLayerRef.current);
    const binsLayer = L.layerGroup();
    bins.forEach((bin) => {
      const marker = L.marker([bin.lat, bin.lng], { icon: BIN_ICON });
      marker.bindPopup(`<b>${bin.name}</b><br/>${bin.id}`);
      marker.addTo(binsLayer);
    });
    binsLayer.addTo(map);
    binsLayerRef.current = binsLayer;
  }, [bins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (staffLayerRef.current) map.removeLayer(staffLayerRef.current);
    const staffLayer = L.layerGroup();
    const fallbackPositions: L.LatLngTuple[] = [
      [41.162, -8.5843], [41.16135, -8.58435], [41.1615, -8.5834],
      [41.16215, -8.58365], [41.16165, -8.58305],
    ];
    staff.forEach((member, idx) => {
      if (member.id === user?.id) return;
      const fallback = fallbackPositions[idx % fallbackPositions.length];
      const icon = L.divIcon({
        className: 'staff-marker',
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:${roleColor(member.role)};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.35);">${roleIcon(member.role)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker(fallback, { icon });
      marker.bindPopup(`<b>${member.name}</b><br/>${member.role}`);
      marker.addTo(staffLayer);
    });
    staffLayer.addTo(map);
    staffLayerRef.current = staffLayer;
  }, [staff, user?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (!showHeatmap || !heatmap.length) return;
    const points: [number, number, number][] = heatmap
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => [p.latitude, p.longitude, Math.max(0.2, Math.min(1, p.weight || 0.5))]);
    if (!points.length) return;
    const heatLayer = L.heatLayer(points, {
      radius: 28, blur: 22, maxZoom: 18,
      gradient: { 0.2: '#22C55E', 0.5: '#F59E0B', 0.8: '#EF4444' },
    });
    heatLayer.addTo(map);
    heatLayerRef.current = heatLayer;
  }, [heatmap, showHeatmap]);

  const walkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkIndexRef = useRef(0);

  // Always show current position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (myMarkerRef.current) map.removeLayer(myMarkerRef.current);
    const coords = NODE_COORDS[currentNode] ?? DRAGAO_CENTER;
    const marker = L.marker(coords, { icon: MY_LOCATION_ICON, zIndexOffset: 1000 })
      .bindPopup('<b>A minha posição</b>');
    marker.addTo(map);
    myMarkerRef.current = marker;
  }, [currentNode]);

  // Simulate walking along route — smooth interpolation between nodes
  useEffect(() => {
    if (walkIntervalRef.current) { clearInterval(walkIntervalRef.current); walkIntervalRef.current = null; }
    if (!activeNav || !activeNav.waypoints.length) {
      // Reset to normal icon when not navigating
      if (myMarkerRef.current) myMarkerRef.current.setIcon(MY_LOCATION_ICON);
      return;
    }

    const coords: L.LatLngTuple[] = activeNav.waypoints
      .map((wp) => NODE_COORDS[wp.node_id])
      .filter((c): c is L.LatLngTuple => !!c);

    if (coords.length < 2) return;

    // Switch to navigation arrow icon
    if (myMarkerRef.current) myMarkerRef.current.setIcon(NAVIGATING_ICON);

    walkIndexRef.current = 0;
    let segmentProgress = 0;
    const STEP = 0.02;
    const TICK_MS = 80;

    walkIntervalRef.current = setInterval(() => {
      const from = coords[walkIndexRef.current];
      const to = coords[walkIndexRef.current + 1];
      if (!to) {
        clearInterval(walkIntervalRef.current!);
        walkIntervalRef.current = null;
        // Arrived — reset icon and clear navigation banner
        if (myMarkerRef.current) myMarkerRef.current.setIcon(MY_LOCATION_ICON);
        clearNavigation();
        return;
      }

      segmentProgress = Math.min(1, segmentProgress + STEP);
      const lat = from[0] + (to[0] - from[0]) * segmentProgress;
      const lng = from[1] + (to[1] - from[1]) * segmentProgress;

      if (myMarkerRef.current) myMarkerRef.current.setLatLng([lat, lng]);

      if (segmentProgress >= 1) {
        walkIndexRef.current += 1;
        segmentProgress = 0;
      }
    }, TICK_MS);

    return () => { if (walkIntervalRef.current) clearInterval(walkIntervalRef.current); };
  }, [activeNav, clearNavigation]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    if (!activeNav) return;

    const routeLayer = L.layerGroup();

    // Build polyline from path nodes
    const pathCoords: L.LatLngTuple[] = activeNav.waypoints
      .map((wp) => nodeToLatLng(wp.node_id, activeNav.waypoints))
      .filter((c): c is L.LatLngTuple => c !== null);

    if (pathCoords.length >= 2) {
      L.polyline(pathCoords, { color: '#3B82F6', weight: 4, opacity: 0.85, dashArray: '8 4' }).addTo(routeLayer);
    }

    // Target bin marker
    const targetCoords = NODE_COORDS[activeNav.targetNode];
    if (targetCoords) {
      L.marker(targetCoords, { icon: BIN_ICON })
        .bindPopup(`<b>${activeNav.binName}</b><br/>Destino`)
        .addTo(routeLayer);
    }

    routeLayer.addTo(map);
    routeLayerRef.current = routeLayer;

    // Fit map to route
    if (pathCoords.length >= 2) {
      map.fitBounds(L.latLngBounds(pathCoords), { padding: [40, 40] });
    }
  }, [activeNav]);

  const overlayHidden = sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100';

  return (
    <div className="h-screen relative">
      <div ref={containerRef} className="h-full w-full" />

      {loading && (
        <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm text-gray-700 z-[1000]">
          A carregar mapa...
        </div>
      )}

      {/* Fallback warning — top right (below loading) */}
      {!loading && usingFallbackHeatmap && (
        <div className={`absolute top-4 right-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2 shadow text-xs z-[1000] transition-opacity ${overlayHidden}`}>
          Sem dados em tempo real
        </div>
      )}

      {/* Active navigation banner */}
      {activeNav && (
        <div className={`absolute top-4 left-4 right-16 z-[1000] bg-blue-600 text-white rounded-lg px-4 py-3 shadow-lg flex items-center justify-between transition-opacity ${overlayHidden}`}>
          <div className="flex items-center gap-2">
            <Navigation size={18} />
            <div>
              <p className="font-semibold text-sm">A navegar para {activeNav.binName}</p>
              <p className="text-xs text-blue-100">ETA: ~{Math.ceil(activeNav.etaSeconds / 60)} min</p>
            </div>
          </div>
          <button onClick={clearNavigation} className="text-blue-200 hover:text-white">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Bottom-right panel: switch + legend */}
      <div className={`absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 items-end transition-opacity ${overlayHidden}`}>
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow flex items-center gap-3 text-sm">
          <span className="text-gray-700 font-medium">Heatmap</span>
          <button
            type="button"
            role="switch"
            aria-checked={showHeatmap}
            onClick={() => setShowHeatmap((v) => !v)}
            className={`relative inline-flex w-11 h-6 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${showHeatmap ? 'bg-red-500' : 'bg-gray-200'}`}
          >
            <span className={`pointer-events-none inline-block w-5 h-5 transform rounded-full bg-white shadow-lg transition duration-200 ${showHeatmap ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {showHeatmap && (
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs text-gray-700">
            <div className="font-semibold mb-2">Legenda</div>
            <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded bg-green-500" /><span>Baixo</span></div>
            <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded bg-amber-500" /><span>Médio</span></div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-500" /><span>Alto</span></div>
          </div>
        )}
      </div>

      {/* Bottom-left label */}
      <div className={`absolute bottom-6 left-6 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs text-gray-700 z-[1000] transition-opacity ${overlayHidden}`}>
        Estádio do Dragão • Heatmap • Staff • Lixeiras
      </div>
    </div>
  );
}
