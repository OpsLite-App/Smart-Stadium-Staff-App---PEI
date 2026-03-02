import { create } from 'zustand';
import { api, Node, POI, HeatmapPoint, StaffMember, WS_GATEWAY } from '../services/api';
import { Client } from '@stomp/stompjs';
import 'text-encoding';

const WS_URL = WS_GATEWAY;

console.log(`useMapStore: WS_GATEWAY = ${WS_GATEWAY}`);

interface MapState {
  // Dados do Mapa
  nodes: Record<string, Node>;
  bins: POI[];
  staffMembers: StaffMember[];
  heatmapData: HeatmapPoint[];
  heatmapLoading: boolean;
  activeRoute: { latitude: number; longitude: number }[] | null;
  loading: boolean;
  
  // WebSocket Client
  stompClient: Client | null;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';

  // Actions
  fetchMapData: () => Promise<void>;
  fetchStaff: () => Promise<void>;
  fetchHeatmapData: () => Promise<void>;
  connectWebSocket: (role: string) => Promise<void>;
  disconnectWebSocket: () => void;
  requestRoute: (from: string, to: string) => Promise<void>;
  clearRoute: () => void;
  getNodeCoordinates: (nodeId: string) => { latitude: number; longitude: number } | null;
}

export const useMapStore = create<MapState>((set, get) => ({
  nodes: {},
  bins: [],
  staffMembers: [],
  heatmapData: [],
  heatmapLoading: false,
  activeRoute: null,
  loading: false,
  stompClient: null,
  connectionStatus: 'DISCONNECTED',

  fetchMapData: async () => {
  set({ loading: true });
  try {
    console.log("🌍 A tentar buscar dados da API...");
    console.log(`📍 API via rewrites (/api/...) | WS: ${WS_GATEWAY}`);    
    let apiSuccess = false;
    let nodesMap: Record<string, Node> = {};
    let binsList: POI[] = [];
    
    // TENTAR API PRIMEIRO
    try {
      const [mapData, poisData] = await Promise.all([
        api.getMapGraph(),
        api.getPOIs()
      ]);
      
      if (mapData && mapData.nodes) {
        mapData.nodes.forEach((n: Node) => {
          nodesMap[n.id] = { ...n, latitude: n.x, longitude: n.y };
        });
      }
      
      binsList = poisData
        .filter((p: POI) => p.category?.toLowerCase().includes('bin') || p.category === 'restroom')
        .map((p: POI) => ({ 
          ...p, 
          latitude: p.x, 
          longitude: p.y,
          name: p.name || `Ponto ${p.id}`
        }));
      
      apiSuccess = Object.keys(nodesMap).length > 0;
      console.log(`✅ API respondeu com sucesso! nodes=${Object.keys(nodesMap).length} pois=${binsList.length}`);
    } catch (apiError) {
      console.warn("⚠️ API falhou:", apiError instanceof Error ? apiError.message : 'Erro desconhecido');
    }
    
    // SE API FALHOU, USAR MOCK
    if (!apiSuccess) {
      console.log("🔄 API indisponível - usando dados MOCK");
      
      // DADOS MOCK DO MAPA
      nodesMap = {
        "N1": { id: "N1", x: 41.161300, y: -8.584500, latitude: 41.161300, longitude: -8.584500, type: "normal", level: 0 },
        "N2": { id: "N2", x: 41.161350, y: -8.584000, latitude: 41.161350, longitude: -8.584000, type: "normal", level: 0 },
        "N3": { id: "N3", x: 41.161400, y: -8.583500, latitude: 41.161400, longitude: -8.583500, type: "normal", level: 0 },
        "N4": { id: "N4", x: 41.161450, y: -8.583000, latitude: 41.161450, longitude: -8.583000, type: "normal", level: 0 },
        "N5": { id: "N5", x: 41.161500, y: -8.582500, latitude: 41.161500, longitude: -8.582500, type: "normal", level: 0 },
        "N6": { id: "N6", x: 41.161550, y: -8.582000, latitude: 41.161550, longitude: -8.582000, type: "normal", level: 0 },
        "N7": { id: "N7", x: 41.161600, y: -8.584500, latitude: 41.161600, longitude: -8.584500, type: "normal", level: 0 },
        "N8": { id: "N8", x: 41.161650, y: -8.584000, latitude: 41.161650, longitude: -8.584000, type: "normal", level: 0 },
        "N9": { id: "N9", x: 41.161700, y: -8.583500, latitude: 41.161700, longitude: -8.583500, type: "normal", level: 0 },
        "N10": { id: "N10", x: 41.161750, y: -8.583000, latitude: 41.161750, longitude: -8.583000, type: "normal", level: 0 },
        "Gate1": { id: "Gate1", x: 41.161200, y: -8.584800, latitude: 41.161200, longitude: -8.584800, type: "gate", level: 0 },
        "Gate2": { id: "Gate2", x: 41.161300, y: -8.582500, latitude: 41.161300, longitude: -8.582500, type: "gate", level: 0 },
        "VIP": { id: "VIP", x: 41.161600, y: -8.583800, latitude: 41.161600, longitude: -8.583800, type: "vip", level: 1 },
      };

      binsList = [
        { id: "Bin-1", name: "Lixeira A1 - Setor A", category: "bin", x: 41.161350, y: -8.584200, latitude: 41.161350, longitude: -8.584200, level: 0 },
        { id: "Bin-2", name: "Lixeira B2 - Setor B", category: "bin", x: 41.161450, y: -8.583200, latitude: 41.161450, longitude: -8.583200, level: 0 },
        { id: "Bin-3", name: "Lixeira C3 - Setor C", category: "bin", x: 41.161550, y: -8.584400, latitude: 41.161550, longitude: -8.584400, level: 0 },
        { id: "WC-1", name: "WC - Setor A", category: "restroom", x: 41.161400, y: -8.584600, latitude: 41.161400, longitude: -8.584600, level: 0 },
      ];
    }

    console.log(`📊 Dados carregados:`);
    console.log(`   • Nodes: ${Object.keys(nodesMap).length}`);
    console.log(`   • Bins: ${binsList.length}`);
    console.log(`   • Fonte: ${apiSuccess ? 'API REAL' : 'MOCK'}`);

    set({ 
      nodes: nodesMap, 
      bins: binsList, 
      loading: false 
    });

  } catch (error) {
    console.error("❌ Erro inesperado:", error);
    set({ loading: false });
  }
},

fetchStaff: async () => {
  try {
    console.log("👥 A buscar staff...");
    let staffList: StaffMember[] = [];
    let apiSuccess = false;
    
    // TENTAR API PRIMEIRO
    try {
      const staff = await api.getStaff();
      if (staff && staff.length > 0) {
        staffList = staff;
        apiSuccess = true;
        console.log("✅ Staff da API carregado:", staff.length);
      }
    } catch (apiError) {
      console.warn("⚠️ API staff falhou:", apiError instanceof Error ? apiError.message : 'Erro desconhecido');
    }
    
    // SE API FALHOU, USAR MOCK
    if (!apiSuccess) {
      console.log("🔄 Usando staff MOCK");
      staffList = [
        { id: 1, name: 'João Silva', role: 'Security', status: 'active', location: 'N1' },
        { id: 2, name: 'Maria Santos', role: 'Security', status: 'active', location: 'N3' },
        { id: 3, name: 'Pedro Costa', role: 'Security', status: 'patrol', location: 'N5' },
        { id: 4, name: 'Ana Oliveira', role: 'Cleaning', status: 'active', location: 'N2' },
        { id: 5, name: 'Carlos Rodrigues', role: 'Cleaning', status: 'break', location: 'N4' },
        { id: 6, name: 'Sofia Ferreira', role: 'Supervisor', status: 'active', location: 'VIP' },
        { id: 7, name: 'Rui Almeida', role: 'Medical', status: 'active', location: 'N7' },
      ];
    }
    
    console.log(`👥 Staff carregado: ${staffList.length} pessoas (${apiSuccess ? 'API' : 'MOCK'})`);
    set({ staffMembers: staffList });
    
  } catch (e) {
    console.warn("⚠️ Erro ao carregar staff:", e);
  }
},

fetchHeatmapData: async () => {
  set({ heatmapLoading: true });
  try {
    console.log("🔥 A buscar heatmap...");
    let heatmapPoints: HeatmapPoint[] = [];
    let apiSuccess = false;
    
    // TENTAR API PRIMEIRO
    try {
      const response = await api.getHeatmapPoints();
      if (response && response.points && response.points.length > 0) {
        heatmapPoints = response.points;
        apiSuccess = true;
        console.log(`✅ Heatmap da API: ${heatmapPoints.length} pontos`);
      }
    } catch (apiError) {
      console.warn("⚠️ API heatmap falhou:", apiError instanceof Error ? apiError.message : 'Erro desconhecido');
    }
    
    // SE API FALHOU, USAR MOCK
    if (!apiSuccess) {
      console.log("🔄 Usando heatmap MOCK");
      heatmapPoints = [
        { latitude: 41.161350, longitude: -8.584200, weight: 0.9, occupancy_rate: 90, heat_level: 'red' },
        { latitude: 41.161450, longitude: -8.583200, weight: 0.6, occupancy_rate: 60, heat_level: 'yellow' },
        { latitude: 41.161550, longitude: -8.584400, weight: 0.4, occupancy_rate: 40, heat_level: 'green' },
        { latitude: 41.161650, longitude: -8.583800, weight: 0.8, occupancy_rate: 85, heat_level: 'red' },
        { latitude: 41.161750, longitude: -8.584100, weight: 0.3, occupancy_rate: 30, heat_level: 'green' },
        { latitude: 41.161250, longitude: -8.584500, weight: 0.7, occupancy_rate: 75, heat_level: 'yellow' },
      ];
    }

    console.log(`🔥 Heatmap: ${heatmapPoints.length} pontos (${apiSuccess ? 'API' : 'MOCK'})`);
    set({ heatmapData: heatmapPoints, heatmapLoading: false });
    
  } catch (error) {
    console.error("❌ Erro ao gerar heatmap:", error);
    set({ heatmapData: [], heatmapLoading: false });
  }
},
  connectWebSocket: async (role: string) => {
    if (get().stompClient?.connected) {
      console.log("WebSocket já conectado");
      return;
    }

    set({ connectionStatus: 'CONNECTING' });
    
    // Web: usar localStorage em vez de SecureStore
    let token = null;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          token = parsed.state?.user?.token;
        } catch (e) {
          console.error("Erro ao ler token do localStorage:", e);
        }
      }
    }
    
    console.log(`Conectando WebSocket como ${role}...`);
    console.log(`URL: ${WS_URL}`);

    const client = new Client({
      webSocketFactory: () => new WebSocket(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${token || 'dev-token'}`,
        role
      },
      debug: (str) => console.log(`WebSocket Debug: ${str}`),
      
      onConnect: () => {
        console.log("WebSocket Conectado!");
        set({ connectionStatus: 'CONNECTED' });

        // --- SUBSCRIÇÕES ---

        // 1. Crowd / Heatmap (Security & Supervisor)
        if (role === 'Security' || role === 'Supervisor') {
          client.subscribe('/topic/crowd', (message) => {
            console.log("WebSocket: Mensagem crowd recebida");
            try {
              const payload = JSON.parse(message.body);
              console.log("Payload:", payload);
              
              const nodesMap = get().nodes;
              const node = nodesMap[payload.gate]; 
              
              if (node) {
                const weight = payload.heat === 'red' ? 1.0 : (payload.heat === 'yellow' ? 0.6 : 0.2);
                const newPoint = { latitude: node.x, longitude: node.y, weight };
                
                set(state => {
                  // Remove ponto antigo na mesma coordenada para não acumular
                  const filtered = state.heatmapData.filter(p => 
                    p.latitude !== newPoint.latitude || p.longitude !== newPoint.longitude
                  );
                  return { heatmapData: [...filtered, newPoint] };
                });
                console.log("Ponto heatmap atualizado via WebSocket");
              }
            } catch (e) {
              console.error("Erro processando mensagem WebSocket:", e);
            }
          });
          console.log("Subscrito: /topic/crowd");
        }

        // 2. Lixeiras (Cleaning & Supervisor)
        if (role === 'Cleaning' || role === 'Supervisor') {
          client.subscribe('/topic/maintenance', (message) => {
            try {
              const payload = JSON.parse(message.body);
              console.log(`WebSocket Maintenance:`, payload);
              if (payload.fill_pct > 80) {
                 console.log(`ALERTA: ${payload.bin_id} cheia!`);
              }
            } catch (e) {
              console.error("Erro maintenance WebSocket:", e);
            }
          });
          console.log("Subscrito: /topic/maintenance");
        }
        
        // 3. Emergência (Todos)
        client.subscribe('/topic/emergency', (message) => {
            try {
              const payload = JSON.parse(message.body);
              console.log("EMERGENCIA RECEBIDA:", payload);
              alert(`EMERGENCIA: ${payload.message || 'Evacuar zona!'}`);
            } catch (e) {
              console.error("Erro emergency WebSocket:", e);
            }
        });
        console.log("Subscrito: /topic/emergency");
      },
      
      onStompError: (frame) => {
        console.error('Erro Broker WebSocket:', frame.headers['message']);
        console.error('Detalhes:', frame.body);
        set({ connectionStatus: 'DISCONNECTED' });
      },
      
      onWebSocketClose: () => {
        console.log('WebSocket Desconectado');
        set({ connectionStatus: 'DISCONNECTED' });
      },
      
      onWebSocketError: (error) => {
        console.error('Erro WebSocket:', error);
        set({ connectionStatus: 'DISCONNECTED' });
      }
    });

    client.activate();
    set({ stompClient: client });
    console.log("WebSocket client ativado");
  },

  disconnectWebSocket: () => {
    const client = get().stompClient;
    if (client) {
      console.log("A desligar WebSocket...");
      client.deactivate();
      set({ stompClient: null, connectionStatus: 'DISCONNECTED' });
      console.log("WebSocket desligado");
    }
  },

  requestRoute: async (from, to) => {
     try {
      console.log(`Calculando rota: ${from} → ${to}`);
      const response = await api.calculateRoute({
        from_node: from,
        to_node: to,
        avoid_crowds: true
      });
      
      const nodesMap = get().nodes;
      const coords = response.path
        .map(id => {
          const node = nodesMap[id];
          return node ? { latitude: node.x, longitude: node.y } : null;
        })
        .filter((c): c is {latitude: number, longitude: number} => c !== null);

      if (coords.length > 0) {
        console.log(`Rota calculada: ${coords.length} pontos`);
        set({ activeRoute: coords });
      } else {
        console.log("Rota vazia");
      }
      
    } catch (e) {
      console.error("Erro rota:", e);
    }
  },

  clearRoute: () => {
    console.log("Limpando rota");
    set({ activeRoute: null });
  },
  
  getNodeCoordinates: (id) => {
    const n = get().nodes[id];
    return n ? { latitude: n.x, longitude: n.y } : null;
  }
}));
