import { create } from 'zustand';
import { api, Node, POI, HeatmapPoint, StaffMember } from '../services/api';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import 'text-encoding'; 
import Constants from 'expo-constants';

// 1. Lógica de IP Automático com Fallback de Segurança
const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
const LOCAL_IP = debuggerHost?.split(':').shift() || '192.168.1.137'; 

// WebSocket usa o IP dinâmico
const WS_URL = `ws://${LOCAL_IP}:8089/ws/websocket`;

interface MapState {
  // Dados do Mapa
  nodes: Record<string, Node>;
  bins: POI[];
  staffMembers: StaffMember[]; // <--- NOVO: Lista de colegas
  heatmapData: HeatmapPoint[];
  activeRoute: { latitude: number; longitude: number }[] | null;
  loading: boolean;
  
  // WebSocket Client
  stompClient: Client | null;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';

  // Actions
  fetchMapData: () => Promise<void>;
  fetchStaff: () => Promise<void>; // <--- NOVO: Função para buscar colegas
  connectWebSocket: (role: string) => Promise<void>;
  disconnectWebSocket: () => void;
  requestRoute: (from: string, to: string) => Promise<void>;
  clearRoute: () => void;
  getNodeCoordinates: (nodeId: string) => { latitude: number; longitude: number } | null;
}

export const useMapStore = create<MapState>((set, get) => ({
  nodes: {},
  bins: [],
  staffMembers: [], // Inicialmente vazio
  heatmapData: [],
  activeRoute: null,
  loading: false,
  stompClient: null,
  connectionStatus: 'DISCONNECTED',

  fetchMapData: async () => {
    set({ loading: true });
    try {
      console.log("📍 A carregar Mapa Estático...");
      const [mapData, poisData] = await Promise.all([
        api.getMapGraph(),
        api.getPOIs()
      ]);

      const nodesMap: Record<string, Node> = {};
      if (mapData.nodes) {
        mapData.nodes.forEach(n => nodesMap[n.id] = n);
      }

      // Filtra apenas POIs que são lixeiras
      const realBins = poisData
        .filter(p => p.category?.toLowerCase().includes('bin'))
        .map(p => ({ ...p, x: p.x, y: p.y }));

      set({ nodes: nodesMap, bins: realBins, loading: false });
    } catch (e) {
      console.error("❌ Erro ao carregar mapa:", e);
      set({ loading: false });
    }
  },

  fetchStaff: async () => {
    try {
      const staff = await api.getStaff();
      set({ staffMembers: staff });
    } catch (e) {
      console.warn("⚠️ Erro ao atualizar staff:", e);
    }
  },

  connectWebSocket: async (role: string) => {
    if (get().stompClient?.connected) return;

    set({ connectionStatus: 'CONNECTING' });
    const token = await SecureStore.getItemAsync('userToken');

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token || 'dev-token'}`,
        role: role 
      },
      debug: (str) => {}, 
      
      onConnect: () => {
        console.log("✅ WebSocket Conectado!");
        set({ connectionStatus: 'CONNECTED' });

        // --- SUBSCRIÇÕES ---

        // 1. Crowd / Heatmap (Security & Supervisor)
        if (role === 'Security' || role === 'Supervisor') {
          client.subscribe('/topic/crowd', (message) => {
            const payload = JSON.parse(message.body);
            
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
            }
          });
          console.log("📡 Subscrito: /topic/crowd");
        }

        // 2. Lixeiras (Cleaning & Supervisor)
        if (role === 'Cleaning' || role === 'Supervisor') {
          client.subscribe('/topic/maintenance', (message) => {
            const payload = JSON.parse(message.body);
            if (payload.fill_pct > 80) {
               console.log(`⚠️ ALERTA: ${payload.bin_id} cheia!`);
            }
          });
          console.log("📡 Subscrito: /topic/maintenance");
        }
        
        // 3. Emergência (Todos)
        client.subscribe('/topic/emergency', (message) => {
            const payload = JSON.parse(message.body);
            console.log("🚨 EMERGÊNCIA RECEBIDA:", payload);
            alert(`🚨 EMERGÊNCIA: ${payload.message || 'Evacuar zona!'}`);
        });
      },
      onStompError: (frame) => {
        console.error('❌ Erro Broker:', frame.headers['message']);
        console.error('Detalhes:', frame.body);
      },
      onWebSocketClose: () => {
        console.log('🔌 WebSocket Desconectado');
        set({ connectionStatus: 'DISCONNECTED' });
      }
    });

    client.activate();
    set({ stompClient: client });
  },

  disconnectWebSocket: () => {
    const client = get().stompClient;
    if (client) {
      client.deactivate();
      set({ stompClient: null, connectionStatus: 'DISCONNECTED' });
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
          return node ? { latitude: node.x, longitude: node.y } : null;
        })
        .filter((c): c is {latitude: number, longitude: number} => c !== null);

      if (coords.length > 0) set({ activeRoute: coords });
      
    } catch (e) {
      console.error("Erro rota:", e);
    }
  },

  clearRoute: () => set({ activeRoute: null }),
  
  getNodeCoordinates: (id) => {
    const n = get().nodes[id];
    return n ? { latitude: n.x, longitude: n.y } : null;
  }
}));