import { create } from 'zustand';
import { api, Node, POI, HeatmapPoint, StaffMember } from '../services/api';
import { Client } from '@stomp/stompjs';
import * as SecureStore from 'expo-secure-store';
import 'text-encoding'; 
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 1. Lógica de IP Automático CORRIGIDA
const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
// Função para obter IP correto por plataforma
// No useMapStore.ts, mesma lógica:
const getLocalIP = () => {
  if (Platform.OS === 'ios') {
    return '192.168.1.82'; // ← MESMO IP AQUI!
  } else if (Platform.OS === 'android') {
    return '10.0.2.2';  // Android Emulator
  }
  return debuggerHost?.split(':').shift() || '192.168.1.82';
};

const LOCAL_IP = getLocalIP();


// WebSocket usa o IP dinâmico
const WS_URL = `ws://${LOCAL_IP}:8089/ws/websocket`;

console.log(`🌐 useMapStore: IP = ${LOCAL_IP}, WebSocket = ${WS_URL}`);

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
      console.log("📍 Iniciando fetchMapData...");
      console.log(`📡 Usando IP: ${LOCAL_IP}`);
      
      // 1. Verificar saúde do serviço
      const isHealthy = await api.checkMapServiceHealth?.();
      console.log(`🔍 Map Service health: ${isHealthy ? '✅ OK' : '❌ OFFLINE'}`);
      
      if (!isHealthy) {
        console.warn("⚠️ Map Service parece offline. Tentando continuar...");
      }

      // 2. Buscar dados em paralelo
      const [mapData, poisData] = await Promise.all([
        api.getMapGraph(),
        api.getPOIs()
      ]);

      // 3. Processar nodes
      const nodesMap: Record<string, Node> = {};
      if (mapData.nodes) {
        mapData.nodes.forEach(n => {
          nodesMap[n.id] = n;
        });
      }

      // 4. Processar POIs (lixeiras)
      const realBins = poisData
        .filter(p => p.category?.toLowerCase().includes('bin') || p.category === 'restroom')
        .map(p => ({ 
          ...p, 
          x: p.x, 
          y: p.y,
          name: p.name || `Ponto ${p.id}`
        }));

      console.log(`✅ Dados carregados:`);
      console.log(`   • Nodes: ${Object.keys(nodesMap).length}`);
      console.log(`   • Bins: ${realBins.length}`);
      
      if (Object.keys(nodesMap).length > 0) {
        console.log("📍 Primeiro node:", Object.values(nodesMap)[0]);
      }

      set({ 
        nodes: nodesMap, 
        bins: realBins, 
        loading: false 
      });

    } catch (e: any) {
      console.error("❌ Erro em fetchMapData:", e.message);
      console.error("Stack trace:", e.stack);
      set({ loading: false });
      
      if (e.message.includes('Network Error') || e.message.includes('timeout')) {
        console.warn("⚠️ Erro de rede detectado. Verifique conexão.");
      }
      
      throw e;
    }
  },

  fetchStaff: async () => {
    try {
      const staff = await api.getStaff();
      console.log(`👥 Staff carregado: ${staff.length} pessoas`);
      set({ staffMembers: staff });
    } catch (e) {
      console.warn("⚠️ Erro ao atualizar staff:", e);
    }
  },

  fetchHeatmapData: async () => {
    set({ heatmapLoading: true });
    try {
      console.log("🔄 A buscar dados do heatmap...");
      console.log(`📡 Congestion Service URL: http://${LOCAL_IP}:8005/api/heatmap/points`);
      
      const response = await api.getHeatmapPoints();
      
      // 🔥 LOGGING DETALHADO
      console.log(`✅ API Response: ${response.points?.length || 0} pontos`);
      console.log(`📊 Response timestamp: ${response.timestamp}`);
      
      if (response.points.length > 0) {
        console.log("📍 Primeiro ponto:", JSON.stringify(response.points[0]));
        console.log("📍 Último ponto:", JSON.stringify(response.points[response.points.length - 1]));
      } else {
        console.log("ℹ️  Heatmap vazio - sem dados ainda");
      }
      
      // Transformar os pontos para o formato que o React Native Maps espera
      const heatmapPoints = response.points.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        weight: point.weight || 0.5
      }));
      
      console.log(`✅ Heatmap atualizado: ${heatmapPoints.length} pontos`);
      
      set({ 
        heatmapData: heatmapPoints,
        heatmapLoading: false 
      });
      
    } catch (error: any) {
      console.error("❌ Erro ao atualizar heatmap:", error.message);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      }
      if (error.request) {
        console.error("Request:", error.request);
      }
      set({ 
        heatmapData: [],
        heatmapLoading: false 
      });
    }
  },

  connectWebSocket: async (role: string) => {
    if (get().stompClient?.connected) {
      console.log("🔌 WebSocket já conectado");
      return;
    }

    set({ connectionStatus: 'CONNECTING' });
    const token = await SecureStore.getItemAsync('userToken');
    
    console.log(`🔌 Conectando WebSocket como ${role}...`);
    console.log(`🔌 URL: ${WS_URL}`);

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token || 'dev-token'}`,
        role: role 
      },
      debug: (str) => {
        console.log(`🔌 WebSocket Debug: ${str}`);
      },
      
      onConnect: () => {
        console.log("✅ WebSocket Conectado!");
        set({ connectionStatus: 'CONNECTED' });

        // --- SUBSCRIÇÕES ---

        // 1. Crowd / Heatmap (Security & Supervisor)
        if (role === 'Security' || role === 'Supervisor') {
          client.subscribe('/topic/crowd', (message) => {
            console.log("📨 WebSocket: Mensagem crowd recebida");
            try {
              const payload = JSON.parse(message.body);
              console.log("📊 Payload:", payload);
              
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
                console.log("✅ Ponto heatmap atualizado via WebSocket");
              }
            } catch (e) {
              console.error("❌ Erro processando mensagem WebSocket:", e);
            }
          });
          console.log("📡 Subscrito: /topic/crowd");
        }

        // 2. Lixeiras (Cleaning & Supervisor)
        if (role === 'Cleaning' || role === 'Supervisor') {
          client.subscribe('/topic/maintenance', (message) => {
            try {
              const payload = JSON.parse(message.body);
              console.log(`📨 WebSocket Maintenance:`, payload);
              if (payload.fill_pct > 80) {
                 console.log(`⚠️ ALERTA: ${payload.bin_id} cheia!`);
              }
            } catch (e) {
              console.error("❌ Erro maintenance WebSocket:", e);
            }
          });
          console.log("📡 Subscrito: /topic/maintenance");
        }
        
        // 3. Emergência (Todos)
        client.subscribe('/topic/emergency', (message) => {
            try {
              const payload = JSON.parse(message.body);
              console.log("🚨 EMERGÊNCIA RECEBIDA:", payload);
              alert(`🚨 EMERGÊNCIA: ${payload.message || 'Evacuar zona!'}`);
            } catch (e) {
              console.error("❌ Erro emergency WebSocket:", e);
            }
        });
        console.log("📡 Subscrito: /topic/emergency");
      },
      
      onStompError: (frame) => {
        console.error('❌ Erro Broker WebSocket:', frame.headers['message']);
        console.error('Detalhes:', frame.body);
        set({ connectionStatus: 'DISCONNECTED' });
      },
      
      onWebSocketClose: () => {
        console.log('🔌 WebSocket Desconectado');
        set({ connectionStatus: 'DISCONNECTED' });
      },
      
      onWebSocketError: (error) => {
        console.error('❌ Erro WebSocket:', error);
        set({ connectionStatus: 'DISCONNECTED' });
      }
    });

    client.activate();
    set({ stompClient: client });
    console.log("✅ WebSocket client ativado");
  },

  disconnectWebSocket: () => {
    const client = get().stompClient;
    if (client) {
      console.log("🔌 A desligar WebSocket...");
      client.deactivate();
      set({ stompClient: null, connectionStatus: 'DISCONNECTED' });
      console.log("✅ WebSocket desligado");
    }
  },

  requestRoute: async (from, to) => {
     try {
      console.log(`📍 Calculando rota: ${from} → ${to}`);
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
        console.log(`✅ Rota calculada: ${coords.length} pontos`);
        set({ activeRoute: coords });
      } else {
        console.log("⚠️ Rota vazia");
      }
      
    } catch (e) {
      console.error("❌ Erro rota:", e);
    }
  },

  clearRoute: () => {
    console.log("🗺️ Limpando rota");
    set({ activeRoute: null });
  },
  
  getNodeCoordinates: (id) => {
    const n = get().nodes[id];
    return n ? { latitude: n.x, longitude: n.y } : null;
  }
}));