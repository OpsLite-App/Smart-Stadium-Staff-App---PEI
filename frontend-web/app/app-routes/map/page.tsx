'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { api, type HeatmapPoint, type StaffMember, type StaffPosition, mapCoordsToLatLng, MAINTENANCE_BASE } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { Navigation as _Nav, X, MapPin, Clock, ChevronRight, ArrowUp, Users, AlertTriangle, DoorOpen, TrendingUp, RefreshCw } from 'lucide-react';

// ── Crowd & Queue types ──
interface AreaDensity {
  area_id: string;
  area_type: string;
  current_count: number;
  capacity: number;
  occupancy_rate: number;
  heat_level: 'green' | 'yellow' | 'red';
  status: string;
}

interface QueueEntry {
  location_id: string;
  location_type: string;
  wait_time_minutes: number;
  queue_length: number;
  status: string;
  utilization: number;
}

interface CrowdSummary {
  total_people: number;
  total_capacity: number;
  avg_occupancy: number;
  overall_status: string;
  by_heat_level: { green: number; yellow: number; red: number };
}

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
  N15: [41.16100, -8.58380],
  N16: [41.16090, -8.58340],
  N17: [41.16110, -8.58300],
  N18: [41.16150, -8.58290],
  N19: [41.16175, -8.58270],
};

function nodeToLatLng(nodeId: string): L.LatLngTuple | null {
  return NODE_COORDS[nodeId] ?? null;
}

// Calculate bearing (degrees) between two lat/lng points
function getBearing(from: L.LatLngTuple, to: L.LatLngTuple): number {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const dLng = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getDirectionLabel(bearing: number): string {
  if (bearing < 22.5 || bearing >= 337.5) return 'Siga em frente';
  if (bearing < 67.5) return 'Vire à direita';
  if (bearing < 112.5) return 'Vire à direita';
  if (bearing < 157.5) return 'Vire à direita';
  if (bearing < 202.5) return 'Siga em frente';
  if (bearing < 247.5) return 'Vire à esquerda';
  if (bearing < 292.5) return 'Vire à esquerda';
  return 'Vire à esquerda';
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
  html: `<div style="width:32px;height:32px;border-radius:8px;background:#fff;border:2px solid #065F46;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:18px;">🗑️</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const MY_LOCATION_ICON = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#3B82F6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
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
  const gatesLayerRef = useRef<L.LayerGroup | null>(null);
  const walkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const walkIndexRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffPositions, setStaffPositions] = useState<Record<string, StaffPosition>>({});
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [usingFallbackHeatmap, setUsingFallbackHeatmap] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bins, setBins] = useState<BinPoint[]>(DEFAULT_BINS);

  // Crowd & Queue panel
  const [showCrowdPanel, setShowCrowdPanel] = useState(false);
  const [crowdSummary, setCrowdSummary] = useState<CrowdSummary | null>(null);
  const [crowdAreas, setCrowdAreas] = useState<AreaDensity[]>([]);
  const [queues, setQueues] = useState<QueueEntry[]>([]);
  const [crowdLoading, setCrowdLoading] = useState(false);
  const [crowdLastUpdated, setCrowdLastUpdated] = useState<Date | null>(null);

  // Navigation HUD state
  const [currentBearing, setCurrentBearing] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [distanceLeft, setDistanceLeft] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);

  const { user } = useAuthStore();
  const { active: activeNav, clearNavigation } = useNavigationStore();

  // Detect sidebar open
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const overlay = document.querySelector('.fixed.inset-0.z-30.bg-gray-600');
      setSidebarOpen(!!overlay);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Crowd & Queue data fetch
  const fetchCrowdData = async () => {
    setCrowdLoading(true);
    try {
      const [summary, areas, queueData] = await Promise.all([
        api.getCrowdSummary().catch(() => null),
        api.getCrowdAreas().catch(() => []),
        api.getQueueStatus().catch(() => []),
      ]);
      if (summary) setCrowdSummary(summary);
      setCrowdAreas(areas);
      setQueues(queueData);
      setCrowdLastUpdated(new Date());
    } finally {
      setCrowdLoading(false);
    }
  };

  useEffect(() => {
    fetchCrowdData();
    const t = setInterval(fetchCrowdData, 20000);
    return () => clearInterval(t);
  }, []);

  // Init map
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
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Load data
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

        // Fetch real positions from Positioning Service
        const positions = await api.getStaffPositions(staffData.map((s) => String(s.id))).catch(() => []);
        const posMap: Record<string, StaffPosition> = {};
        for (const p of positions) posMap[p.staff_id] = p;
        setStaffPositions(posMap);
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

  // Bins layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (binsLayerRef.current) map.removeLayer(binsLayerRef.current);
    const layer = L.layerGroup();
    bins.forEach((bin) => {
      L.marker([bin.lat, bin.lng], { icon: BIN_ICON })
        .bindPopup(`<b>${bin.name}</b><br/>${bin.id}`)
        .addTo(layer);
    });
    layer.addTo(map);
    binsLayerRef.current = layer;
  }, [bins]);

  // Staff layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (staffLayerRef.current) map.removeLayer(staffLayerRef.current);
    const layer = L.layerGroup();
    const fallbackPositions: L.LatLngTuple[] = [
      [41.162, -8.5843], [41.16135, -8.58435], [41.1615, -8.5834],
      [41.16215, -8.58365], [41.16165, -8.58305],
    ];
    staff.forEach((member, idx) => {
      if (member.id === user?.id) return;
      const icon = L.divIcon({
        className: 'staff-marker',
        html: `<div style="width:30px;height:30px;border-radius:9999px;background:${roleColor(member.role)};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.35);">${roleIcon(member.role)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const pos = staffPositions[String(member.id)];
      const latlng: L.LatLngTuple = pos
        ? mapCoordsToLatLng(pos.x, pos.y)
        : fallbackPositions[idx % fallbackPositions.length];
      const confidenceLabel = pos ? ` · ${Math.round(pos.confidence * 100)}%` : '';
      L.marker(latlng, { icon })
        .bindPopup(`<b>${member.name}</b><br/>${member.role}${confidenceLabel}`)
        .addTo(layer);
    });
    layer.addTo(map);
    staffLayerRef.current = layer;
  }, [staff, staffPositions, user?.id]);

  // Heatmap layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (!showHeatmap || !heatmap.length) return;
    const points: [number, number, number][] = heatmap
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => [p.latitude, p.longitude, Math.max(0.2, Math.min(1, p.weight || 0.5))]);
    if (!points.length) return;
    const layer = L.heatLayer(points, {
      radius: 28, blur: 22, maxZoom: 18,
      gradient: { 0.2: '#22C55E', 0.5: '#F59E0B', 0.8: '#EF4444' },
    });
    layer.addTo(map);
    heatLayerRef.current = layer;
  }, [heatmap, showHeatmap]);

  // Gates layer — redrawn when queue data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gatesLayerRef.current) { map.removeLayer(gatesLayerRef.current); gatesLayerRef.current = null; }

    const layer = L.layerGroup();

    api.getGates().then((gates) => {
      gates.forEach((gate) => {
        const q = queues.find((qu) => qu.location_id === gate.id);
        const isUnstable = q ? q.utilization > 1 || q.status === 'unstable' : false;
        const utilPct = q ? Math.min(100, Math.round(q.utilization * 100)) : 0;
        const queueLen = q?.queue_length ?? 0;
        const color = isUnstable ? '#EF4444' : utilPct >= 75 ? '#F59E0B' : '#10B981';
        const pulse = isUnstable ? `animation:ping 1s infinite;` : '';

        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:48px;height:48px;">
            ${isUnstable ? `<div style="position:absolute;inset:0;border-radius:9999px;background:rgba(239,68,68,0.3);${pulse}"></div>` : ''}
            <div style="position:absolute;inset:4px;background:${color};border-radius:10px;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
              <span style="color:white;font-size:9px;font-weight:700;line-height:1;">${queueLen}</span>
            </div>
          </div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        });

        const waitStr = q
          ? q.wait_time_minutes > 9999 ? '∞ min (instável)' : `~${Math.round(q.wait_time_minutes)} min`
          : 'Sem dados';

        L.marker([gate.x, gate.y], { icon, zIndexOffset: 500 })
          .bindPopup(`
            <div style="min-width:160px">
              <b style="font-size:14px">${gate.id}</b>
              <div style="margin-top:6px;font-size:12px;color:#374151">
                <div>🧍 Fila: <b>${queueLen} pessoas</b></div>
                <div>⏱ Espera: <b style="color:${isUnstable ? '#DC2626' : '#059669'}">${waitStr}</b></div>
                ${q ? `<div>📊 Utilização: <b>${utilPct}%</b></div>` : ''}
                ${isUnstable ? '<div style="margin-top:4px;color:#DC2626;font-weight:600">⚠ Abrir portão extra</div>' : ''}
              </div>
            </div>
          `)
          .addTo(layer);
      });

      layer.addTo(map);
      gatesLayerRef.current = layer;
    }).catch(() => {});
  }, [queues]);

  // Route layer — draw path with animated dashes + progress overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    if (!activeNav) return;

    const layer = L.layerGroup();
    const pathCoords: L.LatLngTuple[] = activeNav.waypoints
      .map((wp) => nodeToLatLng(wp.node_id))
      .filter((c): c is L.LatLngTuple => c !== null);

    if (pathCoords.length >= 2) {
      // Shadow line (thicker, lighter)
      L.polyline(pathCoords, { color: '#93C5FD', weight: 10, opacity: 0.4 }).addTo(layer);
      // Main route line
      L.polyline(pathCoords, { color: '#2563EB', weight: 5, opacity: 0.95 }).addTo(layer);
      // Animated dashes on top
      L.polyline(pathCoords, {
        color: '#FFFFFF', weight: 3, opacity: 0.7,
        dashArray: '10 14', dashOffset: '0',
      }).addTo(layer);

      // Node dots along path
      pathCoords.forEach((coord, i) => {
        if (i === 0 || i === pathCoords.length - 1) return;
        L.circleMarker(coord, {
          radius: 5, color: '#2563EB', fillColor: '#fff',
          fillOpacity: 1, weight: 2,
        }).addTo(layer);
      });
    }

    // Destination marker (pulsing)
    const targetCoords = nodeToLatLng(activeNav.targetNode);
    if (targetCoords) {
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:48px;height:48px;">
          <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(16,185,129,0.25);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:absolute;inset:8px;border-radius:9999px;background:#10B981;border:3px solid white;box-shadow:0 2px 10px rgba(16,185,129,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">🗑️</div>
        </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      L.marker(targetCoords, { icon: destIcon })
        .bindPopup(`<b>${activeNav.binName}</b><br/>Destino`)
        .addTo(layer);
    }

    layer.addTo(map);
    routeLayerRef.current = layer;

    if (pathCoords.length >= 2) {
      map.fitBounds(L.latLngBounds(pathCoords), { padding: [60, 60] });
    }
  }, [activeNav]);

  // Navigation simulation — smooth walk + bearing + HUD updates
  useEffect(() => {
    if (walkIntervalRef.current) { clearInterval(walkIntervalRef.current); walkIntervalRef.current = null; }

    if (!activeNav || !activeNav.waypoints.length) {
      setCurrentInstruction('');
      setArrived(false);
      return;
    }

    const coords: L.LatLngTuple[] = activeNav.waypoints
      .map((wp) => nodeToLatLng(wp.node_id))
      .filter((c): c is L.LatLngTuple => c !== null);

    if (coords.length < 2) return;

    const map = mapRef.current;
    if (!map) return;

    // Create marker with a stable wrapper div — we rotate the inner div via DOM, not setIcon
    const arrowHtml = `
      <div style="width:44px;height:44px;background:linear-gradient(135deg,#2563EB,#1D4ED8);border-radius:9999px;border:3px solid white;box-shadow:0 3px 14px rgba(37,99,235,0.55);display:flex;align-items:center;justify-content:center;transition:transform 0.3s ease;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
      </div>`;
    const navIcon = L.divIcon({ className: 'nav-arrow-icon', html: arrowHtml, iconSize: [44, 44], iconAnchor: [22, 22] });

    if (myMarkerRef.current) map.removeLayer(myMarkerRef.current);
    const marker = L.marker(coords[0], { icon: navIcon, zIndexOffset: 2000 }).addTo(map);
    myMarkerRef.current = marker;

    // Helper to rotate the inner div directly in DOM (smooth CSS transition)
    const setMarkerBearing = (bearing: number) => {
      const el = marker.getElement();
      if (el) {
        const inner = el.querySelector('div') as HTMLElement | null;
        if (inner) inner.style.transform = `rotate(${bearing}deg)`;
      }
    };

    const totalNodes = coords.length;
    walkIndexRef.current = 0;
    setStepIndex(0);
    setArrived(false);

    let segmentProgress = 0;
    const STEP = 0.025;
    const TICK_MS = 60;

    const updateHUD = (from: L.LatLngTuple, to: L.LatLngTuple, nodeIdx: number) => {
      const bearing = getBearing(from, to);
      setCurrentBearing(bearing);
      setCurrentInstruction(getDirectionLabel(bearing));
      setStepIndex(nodeIdx);
      setDistanceLeft((totalNodes - nodeIdx - 1) * 25);
      setMarkerBearing(bearing);
    };

    updateHUD(coords[0], coords[1], 0);

    walkIntervalRef.current = setInterval(() => {
      const from = coords[walkIndexRef.current];
      const to = coords[walkIndexRef.current + 1];

      if (!to) {
        clearInterval(walkIntervalRef.current!);
        walkIntervalRef.current = null;
        setArrived(true);
        setCurrentInstruction('Chegaste ao destino!');
        setDistanceLeft(0);
        // Swap to green check icon
        const doneIcon = L.divIcon({
          className: '',
          html: `<div style="width:40px;height:40px;background:#10B981;border-radius:9999px;border:3px solid white;box-shadow:0 2px 12px rgba(16,185,129,0.6);display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>`,
          iconSize: [40, 40], iconAnchor: [20, 20],
        });
        marker.setIcon(doneIcon);
        setTimeout(() => clearNavigation(), 3000);
        return;
      }

      segmentProgress = Math.min(1, segmentProgress + STEP);
      const lat = from[0] + (to[0] - from[0]) * segmentProgress;
      const lng = from[1] + (to[1] - from[1]) * segmentProgress;
      const bearing = getBearing(from, to);

      marker.setLatLng([lat, lng]);
      setMarkerBearing(bearing);
      if (map) map.panTo([lat, lng], { animate: true, duration: 0.3 });

      if (segmentProgress >= 1) {
        walkIndexRef.current += 1;
        segmentProgress = 0;
        const nextTo = coords[walkIndexRef.current + 1];
        if (nextTo) updateHUD(coords[walkIndexRef.current], nextTo, walkIndexRef.current);
      }
    }, TICK_MS);

    return () => { if (walkIntervalRef.current) clearInterval(walkIntervalRef.current); };
  }, [activeNav, clearNavigation]);

  // Static position marker when not navigating
  useEffect(() => {
    if (activeNav) return; // handled by navigation effect
    const map = mapRef.current;
    if (!map) return;
    if (myMarkerRef.current) map.removeLayer(myMarkerRef.current);
    const marker = L.marker(DRAGAO_CENTER, { icon: MY_LOCATION_ICON, zIndexOffset: 1000 })
      .bindPopup('<b>A minha posição</b>');
    marker.addTo(map);
    myMarkerRef.current = marker;
  }, [activeNav]);

  const overlayHidden = sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100';
  const etaMin = activeNav ? Math.ceil(activeNav.etaSeconds / 60) : 0;

  return (
    <div className="h-screen relative overflow-hidden">
      {/* CSS for destination pulse animation */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>

      <div ref={containerRef} className="h-full w-full" />

      {loading && (
        <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm text-gray-700 z-[1000]">
          A carregar mapa...
        </div>
      )}

      {!loading && usingFallbackHeatmap && !activeNav && (
        <div className={`absolute top-4 right-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2 shadow text-xs z-[1000] transition-opacity ${overlayHidden}`}>
          Sem dados em tempo real
        </div>
      )}

      {/* ── GPS Navigation HUD ── */}
      {activeNav && (
        <div className={`absolute top-0 left-0 right-0 z-[1000] transition-opacity ${overlayHidden}`}>
          {/* Top instruction bar */}
          <div className="bg-[#1E3A8A] text-white px-4 pt-4 pb-3 shadow-xl">
            <div className="flex items-center gap-4">
              {/* Direction arrow */}
              <div className="flex-shrink-0 w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center">
                {arrived ? (
                  <div className="text-2xl">✅</div>
                ) : (
                  <div style={{ transform: `rotate(${currentBearing}deg)`, transition: 'transform 0.4s ease' }}>
                    <ArrowUp size={32} color="white" strokeWidth={2.5} />
                  </div>
                )}
              </div>
              {/* Instruction text */}
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold leading-tight truncate">
                  {currentInstruction || 'A calcular...'}
                </p>
                <p className="text-sm text-blue-200 mt-0.5">
                  {distanceLeft > 0 ? `em ${distanceLeft}m` : ''}
                </p>
              </div>
              {/* Close */}
              <button
                onClick={clearNavigation}
                className="flex-shrink-0 w-9 h-9 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Progress strip */}
          <div className="bg-[#1D4ED8] px-4 py-2 flex items-center gap-4 text-white text-sm shadow-md">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-blue-200" />
              <span className="font-semibold">{etaMin} min</span>
            </div>
            <div className="flex-1 bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{
                  width: `${activeNav.waypoints.length > 1
                    ? Math.min(100, (stepIndex / (activeNav.waypoints.length - 1)) * 100)
                    : 0}%`
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-blue-200" />
              <span className="font-medium truncate max-w-[120px]">{activeNav.binName}</span>
            </div>
          </div>

          {/* Step breadcrumb */}
          <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2 flex items-center gap-2 text-xs text-gray-600 shadow-sm">
            <span className="font-medium text-gray-800">
              Passo {Math.min(stepIndex + 1, activeNav.waypoints.length)} de {activeNav.waypoints.length}
            </span>
            <ChevronRight size={12} className="text-gray-400" />
            <span>{activeNav.waypoints[Math.min(stepIndex, activeNav.waypoints.length - 1)]?.node_id}</span>
            <ChevronRight size={12} className="text-gray-400" />
            <span className="font-medium text-blue-600">{activeNav.targetNode}</span>
          </div>
        </div>
      )}

      {/* Bottom-right controls */}
      {!activeNav && (
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
      )}

      {/* Bottom label + Crowd toggle button */}
      {!activeNav && (
        <div className={`absolute bottom-6 left-6 z-[1000] flex items-center gap-2 transition-opacity ${overlayHidden}`}>
          <button
            onClick={() => setShowCrowdPanel(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow text-sm font-medium border transition-colors ${showCrowdPanel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            <Users size={16} />
            Multidões
            {crowdSummary?.overall_status === 'critical' && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* ── Crowd & Queue Panel ── */}
      {showCrowdPanel && !activeNav && (
        <div className={`absolute top-16 right-4 z-[1000] w-80 max-h-[calc(100vh-6rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-opacity ${overlayHidden}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <Users size={18} />
              <span className="font-bold text-sm">Multidões & Filas</span>
            </div>
            <div className="flex items-center gap-2">
              {crowdLastUpdated && (
                <span className="text-indigo-200 text-xs">{crowdLastUpdated.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              )}
              <button onClick={fetchCrowdData} disabled={crowdLoading} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <RefreshCw size={14} className={crowdLoading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowCrowdPanel(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Summary strip */}
            {crowdSummary && (
              <div className={`px-4 py-3 flex items-center justify-between text-sm border-b ${
                crowdSummary.overall_status === 'critical' ? 'bg-red-50 border-red-100' :
                crowdSummary.overall_status === 'busy' ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
              }`}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className={crowdSummary.overall_status === 'critical' ? 'text-red-500' : 'text-amber-500'} />
                  <span className="font-semibold text-gray-800">{crowdSummary.total_people.toLocaleString()} pessoas</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    crowdSummary.overall_status === 'critical' ? 'bg-red-100 text-red-700' :
                    crowdSummary.overall_status === 'busy' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>{crowdSummary.overall_status.toUpperCase()}</span>
                </div>
              </div>
            )}

            {/* Heat level dots summary */}
            {crowdSummary && (
              <div className="px-4 py-2 flex gap-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span>{crowdSummary.by_heat_level.green} zonas OK</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>{crowdSummary.by_heat_level.yellow} médio</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>{crowdSummary.by_heat_level.red} crítico</span>
                </div>
              </div>
            )}

            {/* Gates / Queue section */}
            {queues.length > 0 && (
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <DoorOpen size={14} className="text-indigo-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Portões</span>
                </div>
                <div className="space-y-2">
                  {queues.map((q) => {
                    const util = Math.min(100, Math.round(q.utilization * 100));
                    const isUnstable = q.status === 'unstable' || q.utilization > 1;
                    const waitDisplay = q.wait_time_minutes > 9999 ? '∞' : `${Math.round(q.wait_time_minutes)} min`;
                    return (
                      <div key={q.location_id} className={`rounded-xl border p-3 ${isUnstable ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isUnstable ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                            <span className="font-semibold text-sm text-gray-800">{q.location_id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{q.queue_length} na fila</span>
                            {isUnstable && <AlertTriangle size={13} className="text-red-500" />}
                          </div>
                        </div>
                        {/* Utilization bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${util >= 100 ? 'bg-red-500' : util >= 75 ? 'bg-amber-400' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, util)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Utilização: <span className={`font-semibold ${util >= 100 ? 'text-red-600' : 'text-gray-700'}`}>{util}%</span></span>
                          <span className={`font-semibold ${isUnstable ? 'text-red-600' : 'text-gray-700'}`}>
                            {isUnstable ? '⚠ Abrir portão extra' : `Espera: ${waitDisplay}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Areas section — top 6 by occupancy */}
            {crowdAreas.length > 0 && (
              <div className="px-4 pt-2 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-indigo-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Zonas</span>
                </div>
                <div className="space-y-1.5">
                  {[...crowdAreas]
                    .sort((a, b) => b.occupancy_rate - a.occupancy_rate)
                    .slice(0, 8)
                    .map((area) => {
                      const pct = Math.min(100, Math.round(area.occupancy_rate));
                      const color = area.heat_level === 'red' ? 'bg-red-500' : area.heat_level === 'yellow' ? 'bg-amber-400' : 'bg-green-500';
                      const textColor = area.heat_level === 'red' ? 'text-red-600' : area.heat_level === 'yellow' ? 'text-amber-600' : 'text-green-600';
                      return (
                        <div key={area.area_id} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-8 shrink-0">{area.area_id}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-10 text-right shrink-0 ${textColor}`}>{pct}%</span>
                          <span className="text-xs text-gray-400 w-12 text-right shrink-0">{area.current_count}p</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
