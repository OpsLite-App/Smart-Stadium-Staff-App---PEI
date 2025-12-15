import { create } from 'zustand';
import { api, Node, POI, HeatmapPoint } from '../services/api';

interface MapState {
  nodes: Record<string, Node>;
  bins: POI[];
  heatmapData: HeatmapPoint[];
  activeRoute: { latitude: number; longitude: number }[] | null;
  loading: boolean;
  
  // Array vazio para compatibilidade com MapScreen antigo
  staff: any[]; 

  fetchMapData: () => Promise<void>;
  fetchLiveStatus: () => Promise<void>;
  requestRoute: (from: string, to: string) => Promise<void>;
  clearRoute: () => void;
  getNodeCoordinates: (nodeId: string) => { latitude: number; longitude: number } | null;
  
  // Função vazia para compatibilidade
  updatePositions: () => void;
}

export const useMapStore = create<MapState>((set, get) => ({
  nodes: {},
  bins: [],
  heatmapData: [],
  activeRoute: null,
  loading: false,
  staff: [], 

  fetchMapData: async () => {
    set({ loading: true });
    try {
      console.log("A carregar Mapa GPS Real...");
      
      const [mapData, poisData] = await Promise.all([
        api.getMapGraph(),
        api.getPOIs()
      ]);

      const nodesMap: Record<string, Node> = {};
      
      if (mapData.nodes) {
        mapData.nodes.forEach(n => {
          nodesMap[n.id] = n; 
        });
      }

      const realBins = poisData
        .filter(p => p.category && (p.category.toLowerCase().includes('bin') || p.category.toLowerCase().includes('trash')))
        .map(p => ({
            ...p,
            x: p.x, 
            y: p.y
        }));

      console.log(`Mapa Carregado: ${Object.keys(nodesMap).length} nós e ${realBins.length}`);

      set({ 
        nodes: nodesMap, 
        bins: realBins,
        loading: false 
      });

    } catch (e) {
      console.error("Erro ao carregar dados:", e);
      set({ loading: false });
    }
  },

  fetchLiveStatus: async () => {
    try {
      const densities = await api.getHeatmap();
      const nodesMap = get().nodes;
      
      if (Object.keys(nodesMap).length === 0) return;

      const points: HeatmapPoint[] = densities
        .map(d => {
          const node = nodesMap[d.area_id];
          if (!node) return null;
          
          let weight = 0.2;
          if (d.heat_level === 'red') weight = 1.0;
          else if (d.heat_level === 'yellow') weight = 0.6;

          return {
            latitude: node.x,  // X é Latitude
            longitude: node.y, // Y é Longitude
            weight: weight
          };
        })
        .filter((p): p is HeatmapPoint => p !== null);

      if (points.length > 0) set({ heatmapData: points });

    } catch (e) {
    }
  },

  requestRoute: async (from, to) => {
    try {
      const response = await api.calculateRoute({
        from_node: from,
        to_node: to,
        avoid_crowds: true
      });
      
      const nodesMap = get().nodes;
      
      const coords = response.path
        .map(id => {
          const node = nodesMap[id];
          if (!node) return null;
          return { latitude: node.x, longitude: node.y };
        })
        .filter((c): c is {latitude: number, longitude: number} => c !== null);

      if (coords.length > 0) set({ activeRoute: coords });
      
    } catch (e) {
      console.error(e);
      alert("Erro ao calcular rota");
    }
  },

  clearRoute: () => set({ activeRoute: null }),
  
  getNodeCoordinates: (id) => {
    const n = get().nodes[id];
    if (!n) return null;
    return { latitude: n.x, longitude: n.y };
  },

  updatePositions: () => { /* No-op */ }
}));