'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
import 'leaflet.heat';
import { useMapStore } from '@/lib/stores/useMapStore';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { theme } from '@/lib/theme';
import { 
  Flame, 
  FlameKindling, 
  Trash2, 
  AlertCircle,
  Target,
  X,
  Bug
} from 'lucide-react';

// Fix para ícones do Leaflet no Next.js
const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

// Interface para pontos do heatmap com cor
interface HeatmapPointWithColor {
  latitude: number;
  longitude: number;
  weight: number;
  occupancy_rate?: number;
  heat_level?: 'green' | 'yellow' | 'red';
  area_id?: string;
}

export default function MapPage() {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const heatLayerRef = useRef<L.Layer | null>(null);
  const circleLayersRef = useRef<L.Circle[]>([]);
  
  const { user } = useAuthStore();
  const { 
    nodes, 
    bins, 
    staffMembers, 
    heatmapData,
    activeRoute,
    loading,
    heatmapLoading,
    fetchMapData,
    fetchStaff,
    fetchHeatmapData,
    clearRoute,
  } = useMapStore();

  // Estado Local
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showBins, setShowBins] = useState(false);
  const [heatmapType, setHeatmapType] = useState<'gradient' | 'circles'>('gradient');

  // Permissões de visualização
  const canViewHeatmap = user?.role === 'Security' || user?.role === 'Supervisor';
  const canViewBins = user?.role === 'Cleaning' || user?.role === 'Supervisor';
  const canViewStaff = true;

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    console.log("🗺️ Inicializando mapa...");
    fixLeafletIcons();

    const stadiumCoords: L.LatLngExpression = [41.161758, -8.583933];

    mapRef.current = L.map(mapContainer.current).setView(stadiumCoords, 18);

    // Adicionar tiles do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapRef.current);

    // Carregar dados
    fetchMapData();
    fetchStaff();

    // Polling para staff
    const staffInterval = setInterval(fetchStaff, 10000);

    return () => {
      clearInterval(staffInterval);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [fetchMapData, fetchStaff]);
// Atualizar heatmap (gradiente)
useEffect(() => {
  if (!mapRef.current || !canViewHeatmap || !showHeatmap || heatmapType !== 'gradient') {
    if (heatLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    return;
  }

  if (heatLayerRef.current) {
    mapRef.current.removeLayer(heatLayerRef.current);
  }

  if (heatmapData.length > 0) {
    console.log(`🔥 Desenhando heatmap gradiente com ${heatmapData.length} pontos`);
    
    const points = heatmapData.map(point => [
      point.latitude,
      point.longitude,
      point.weight
    ]);

    // @ts-ignore - Ignorar erro de tipo do leaflet.heat
    heatLayerRef.current = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 17,
      gradient: {
        0.2: '#10B981',
        0.5: '#F59E0B',
        0.8: '#EF4444'
      }
    }).addTo(mapRef.current);
  }

  return () => {
    if (heatLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
    }
  };
}, [heatmapData, showHeatmap, canViewHeatmap, heatmapType]);
 // Atualizar heatmap (gradiente)
useEffect(() => {
  if (!mapRef.current || !canViewHeatmap || !showHeatmap || heatmapType !== 'gradient') {
    if (heatLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    return;
  }

  if (heatLayerRef.current) {
    mapRef.current.removeLayer(heatLayerRef.current);
  }

  if (heatmapData.length > 0) {
    console.log(`🔥 Desenhando heatmap gradiente com ${heatmapData.length} pontos`);
    
    // 🔥 SOLUÇÃO SIMPLES: usar any
    const points: any = heatmapData.map(point => [
      point.latitude,
      point.longitude,
      point.weight
    ]);

    heatLayerRef.current = (L as any).heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 17,
      gradient: {
        0.2: '#10B981',
        0.5: '#F59E0B',
        0.8: '#EF4444'
      }
    }).addTo(mapRef.current);
  }

  return () => {
    if (heatLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(heatLayerRef.current);
    }
  };
}, [heatmapData, showHeatmap, canViewHeatmap, heatmapType]);
  // Atualizar marcadores de staff
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    staffMembers.forEach(member => {
      const node = nodes[member.location];
      if (!node) {
        console.warn(`⚠️ Node ${member.location} não encontrado para staff ${member.name}`);
        return;
      }
      if (member.id === user?.id) return;

      const getMarkerColor = () => {
        switch (member.role) {
          case 'Security': return '#3B82F6';
          case 'Cleaning': return '#10B981';
          case 'Supervisor': return '#F59E0B';
          case 'Medical': return '#EF4444';
          default: return '#6B7280';
        }
      };

      const getMarkerIcon = () => {
        switch (member.role) {
          case 'Security': return '🛡️';
          case 'Cleaning': return '🧹';
          case 'Medical': return '⚕️';
          default: return '👤';
        }
      };

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            background-color: ${getMarkerColor()};
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            color: white;
            font-size: 20px;
            position: relative;
          ">
            ${getMarkerIcon()}
            <div style="
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid ${getMarkerColor()};
            "></div>
          </div>
        `,
        iconSize: [40, 48],
        iconAnchor: [20, 40]
      });

      const marker = L.marker([node.x, node.y], { icon })
        .bindPopup(`
          <b>${member.name}</b><br>
          ${member.role}<br>
          <small>${member.location}</small>
        `)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [staffMembers, nodes, user?.id]);

  // Atualizar marcadores de lixeiras
  useEffect(() => {
    if (!mapRef.current || !canViewBins || !showBins) return;

    // Remover marcadores antigos de lixeiras (assumindo que estão em markersRef)
    // Como simplificação, vamos recriar todos os marcadores de staff depois
    
    bins.forEach(bin => {
      const icon = L.divIcon({
        className: 'bin-marker',
        html: `
          <div style="
            background-color: #10B981;
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            color: white;
            font-size: 16px;
          ">
            🗑️
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([bin.x, bin.y], { icon })
        .bindPopup(`<b>${bin.name}</b><br>${bin.category}`)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [bins, showBins, canViewBins]);

  // Desenhar rota ativa
  useEffect(() => {
    if (!mapRef.current || !activeRoute || activeRoute.length === 0) return;

    const routePoints = activeRoute.map(point => [point.latitude, point.longitude] as L.LatLngTuple);

    const routeLine = L.polyline(routePoints, {
      color: theme.colors.primary,
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round'
    }).addTo(mapRef.current);

    const lastPoint = activeRoute[activeRoute.length - 1];
    const destIcon = L.divIcon({
      className: 'dest-marker',
      html: `
        <div style="
          background-color: ${theme.colors.error};
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          color: white;
          font-size: 20px;
        ">
          🏁
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const destMarker = L.marker([lastPoint.latitude, lastPoint.longitude], { icon: destIcon })
      .addTo(mapRef.current);

    mapRef.current.fitBounds(L.latLngBounds(routePoints), {
      padding: [50, 50]
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.removeLayer(routeLine);
        mapRef.current.removeLayer(destMarker);
      }
    };
  }, [activeRoute]);

  // Atualizar heatmap periodicamente
  useEffect(() => {
    if (!canViewHeatmap || !showHeatmap) return;

    fetchHeatmapData();
    const heatmapInterval = setInterval(fetchHeatmapData, 30000);

    return () => clearInterval(heatmapInterval);
  }, [canViewHeatmap, showHeatmap, fetchHeatmapData]);

  const getOverlayText = () => {
    if (!user) return 'Operacional • Live';
    if (user.role === 'Supervisor') return 'Supervisão • Modo Global';
    return `${user.role === 'Security' ? 'Segurança' : 'Limpeza'} • Ativo`;
  };

  const handleDebug = () => {
    console.log("🔍 === DEBUG INFO ===");
    console.log("👤 User:", user);
    console.log("🔥 Heatmap data:", heatmapData.length, "pontos");
    console.log("🗺️ Nodes:", Object.keys(nodes).length);
    console.log("🗑️ Bins:", bins.length);
    console.log("👥 Staff:", staffMembers.length);
    console.log("🔄 Heatmap type:", heatmapType);
    console.log("👁️ Show heatmap:", showHeatmap);
    
    alert(
      `Debug Info:\n` +
      `Role: ${user?.role}\n` +
      `Heatmap: ${heatmapData.length} pontos\n` +
      `Nodes: ${Object.keys(nodes).length}\n` +
      `Staff: ${staffMembers.length}\n` +
      `Tipo: ${heatmapType}`
    );
    
    // Forçar atualização
    fetchHeatmapData();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
          <p className="text-gray-600">A carregar mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Overlay de Informação no Topo */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 z-[1000]">
        <span className="font-semibold text-[#4F46E5] text-sm">{getOverlayText()}</span>
        {user?.role === 'Supervisor' && (
          <span className="ml-2 text-xs text-red-600 font-bold">Supervisor</span>
        )}
      </div>

      {/* Botões de Controlo - Lado Direito */}
      <div className="absolute top-20 right-4 space-y-2 z-[1000]">
        {canViewHeatmap && (
          <>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border transition-all w-full
                ${showHeatmap 
                  ? 'bg-[#EF4444] text-white border-[#EF4444]' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }
              `}
            >
              {showHeatmap ? <Flame size={20} /> : <FlameKindling size={20} />}
              <span className="text-sm font-medium">Heatmap</span>
            </button>

            <button
              onClick={() => setHeatmapType(heatmapType === 'gradient' ? 'circles' : 'gradient')}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 w-full"
            >
              <span className="text-sm font-medium">
                {heatmapType === 'gradient' ? '🔴 Círculos' : '🔥 Gradiente'}
              </span>
            </button>
          </>
        )}

        {canViewBins && (
          <button
            onClick={() => setShowBins(!showBins)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border transition-all w-full
              ${showBins 
                ? 'bg-[#10B981] text-white border-[#10B981]' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }
            `}
          >
            <Trash2 size={20} />
            <span className="text-sm font-medium">Lixeiras</span>
          </button>
        )}
      </div>

      {/* Legenda do Heatmap */}
      {canViewHeatmap && showHeatmap && heatmapData.length > 0 && (
        <div className="absolute bottom-24 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 z-[1000]">
          <div className="text-xs font-medium text-gray-700 mb-2">Legenda</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#10B981] rounded"></div>
              <span className="text-xs text-gray-600">Baixo (0-50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#F59E0B] rounded"></div>
              <span className="text-xs text-gray-600">Médio (50-80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#EF4444] rounded"></div>
              <span className="text-xs text-gray-600">Alto (80-100%)</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading do Heatmap */}
      {heatmapLoading && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200 z-[1000] flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#EF4444]"></div>
          <span className="text-sm text-gray-600">Atualizando heatmap...</span>
        </div>
      )}

      {/* Botão de Debug (só em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={handleDebug}
          className="absolute bottom-24 right-4 bg-purple-600 text-white p-3 rounded-full shadow-lg z-[1000] hover:bg-purple-700"
        >
          <Bug size={20} />
        </button>
      )}

      {/* Botões de Ação - Fundo */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-4 z-[1000]">
        {user?.role === 'Cleaning' && bins.length > 0 && (
          <button
            onClick={() => {
              if (bins.length > 0) {
                const firstBin = bins[0];
                mapRef.current?.flyTo([firstBin.x, firstBin.y], 19);
                setShowBins(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-3 bg-[#10B981] text-white rounded-full shadow-lg"
          >
            <Target size={20} />
            <span className="font-medium">Zonas Prioritárias</span>
          </button>
        )}

        {user?.role === 'Security' && (
          <button
            onClick={() => router.push('/emergency')}
            className="flex items-center gap-2 px-4 py-3 bg-[#EF4444] text-white rounded-full shadow-lg"
          >
            <AlertCircle size={20} />
            <span className="font-medium">Emergência</span>
          </button>
        )}

        {activeRoute && activeRoute.length > 0 && (
          <button
            onClick={clearRoute}
            className="flex items-center gap-2 px-4 py-3 bg-[#4F46E5] text-white rounded-full shadow-lg"
          >
            <X size={20} />
            <span className="font-medium">Limpar Rota</span>
          </button>
        )}
      </div>
    </div>
  );
}