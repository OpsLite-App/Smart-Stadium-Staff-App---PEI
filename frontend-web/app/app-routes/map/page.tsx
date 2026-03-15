'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { api, type HeatmapPoint, type StaffMember } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';

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

const DEFAULT_HEATMAP: HeatmapPoint[] = [
  { latitude: 41.16195, longitude: -8.5842, weight: 0.9, heat_level: 'red' },
  { latitude: 41.16165, longitude: -8.58435, weight: 0.75, heat_level: 'yellow' },
  { latitude: 41.16135, longitude: -8.5841, weight: 0.6, heat_level: 'yellow' },
  { latitude: 41.1612, longitude: -8.5837, weight: 0.85, heat_level: 'red' },
  { latitude: 41.16145, longitude: -8.58335, weight: 0.65, heat_level: 'yellow' },
  { latitude: 41.1618, longitude: -8.5832, weight: 0.5, heat_level: 'green' },
  { latitude: 41.16205, longitude: -8.58355, weight: 0.45, heat_level: 'green' },
];

function roleColor(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized.includes('security')) return '#2563EB';
  if (normalized.includes('cleaning')) return '#10B981';
  if (normalized.includes('supervisor')) return '#F59E0B';
  return '#6B7280';
}

function roleIcon(role: string): string {
  const normalized = role.toLowerCase();
  if (normalized.includes('security')) return 'S';
  if (normalized.includes('cleaning')) return 'L';
  if (normalized.includes('supervisor')) return 'SV';
  return 'U';
}

export default function MapPage() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const staffLayerRef = useRef<L.LayerGroup | null>(null);
  const binsLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [usingFallbackHeatmap, setUsingFallbackHeatmap] = useState(false);
  const bins = useMemo(() => DEFAULT_BINS, []);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DRAGAO_CENTER, 17);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [staffData, heatData] = await Promise.all([
          api.getStaff().catch(() => []),
          api.getHeatmapPoints().catch(() => ({ points: [] as HeatmapPoint[] })),
        ]);
        if (!mounted) return;
        setStaff(staffData);
        const validPoints = (heatData.points || []).filter(
          (p) =>
            Number.isFinite(p.latitude) &&
            Number.isFinite(p.longitude) &&
            p.latitude !== 0 &&
            p.longitude !== 0
        );

        if (validPoints.length >= 3) {
          setHeatmap(validPoints);
          setUsingFallbackHeatmap(false);
        } else {
          setHeatmap(DEFAULT_HEATMAP);
          setUsingFallbackHeatmap(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (binsLayerRef.current) map.removeLayer(binsLayerRef.current);
    const binsLayer = L.layerGroup();
    bins.forEach((bin) => {
      const marker = L.circleMarker([bin.lat, bin.lng], {
        radius: 7,
        color: '#065F46',
        fillColor: '#10B981',
        fillOpacity: 0.9,
        weight: 2,
      });
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
      [41.162, -8.5843],
      [41.16135, -8.58435],
      [41.1615, -8.5834],
      [41.16215, -8.58365],
      [41.16165, -8.58305],
    ];

    staff.forEach((member, idx) => {
      if (member.id === user?.id) return;
      const fallback = fallbackPositions[idx % fallbackPositions.length];
      const icon = L.divIcon({
        className: 'staff-marker',
        html: `
          <div style="
            width:30px;height:30px;border-radius:9999px;
            background:${roleColor(member.role)};
            color:white;font-size:11px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
            border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.35);
          ">${roleIcon(member.role)}</div>
        `,
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

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!showHeatmap || !heatmap.length) return;

    const points: [number, number, number][] = heatmap
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => [p.latitude, p.longitude, Math.max(0.2, Math.min(1, p.weight || 0.5))]);

    if (!points.length) return;

    const heatLayer = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 18,
      gradient: {
        0.2: '#22C55E',
        0.5: '#F59E0B',
        0.8: '#EF4444',
      },
    });

    heatLayer.addTo(map);
    heatLayerRef.current = heatLayer;
  }, [heatmap, showHeatmap]);

  return (
    <div className="h-screen relative">
        <div ref={containerRef} className="h-full w-full" />

        {loading && (
          <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm text-gray-700">
            A carregar mapa...
          </div>
        )}

        <div className="absolute top-4 left-4 z-[1000]">
          <button
            onClick={() => setShowHeatmap((prev) => !prev)}
            className={`px-3 py-2 rounded-lg shadow border text-sm font-medium ${
              showHeatmap
                ? 'bg-red-500 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
          </button>
        </div>

        {showHeatmap && (
          <div className="absolute bottom-6 right-6 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs text-gray-700 z-[1000]">
            <div className="font-semibold mb-2">Legenda Heatmap</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded bg-green-500" />
              <span>Baixo</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span>Médio</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-500" />
              <span>Alto</span>
            </div>
          </div>
        )}

        {usingFallbackHeatmap && (
          <div className="absolute top-16 left-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3 py-2 shadow text-xs z-[1000]">
            Heatmap em modo fallback (sem dados em tempo real).
          </div>
        )}

        <div className="absolute bottom-6 left-6 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-xs text-gray-700">
          Estádio do Dragão • Heatmap • Staff • Lixeiras
        </div>
      </div>
  );
}
