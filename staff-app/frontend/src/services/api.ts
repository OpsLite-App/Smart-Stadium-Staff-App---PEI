import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';



export const LOCAL_IP = '192.168.1.137';

console.log(`📡 API Config:`);
console.log(`   • Ambiente: ${__DEV__ ? 'Desenvolvimento' : 'Produção'}`);
console.log(`   • Plataforma: ${Platform.OS}`);
console.log(`   • IP Local: ${LOCAL_IP}`);

// --- URLs DOS SERVIÇOS ---
export const AUTH_SERVICE = `http://${LOCAL_IP}:8081`;
export const MAP_SERVICE = `http://${LOCAL_IP}:8000`;
export const ROUTING_SERVICE = `http://${LOCAL_IP}:8002`;
export const CONGESTION_SERVICE = `http://${LOCAL_IP}:8005`;
export const EMERGENCY_SERVICE = `http://${LOCAL_IP}:8006`;
export const MAINTENANCE_SERVICE = `http://${LOCAL_IP}:8007`;
export const WS_GATEWAY = `ws://${LOCAL_IP}:8089/ws/websocket`;

// --- Interfaces de Dados ---

export interface LoginResponse {
  token: string;
  user_id: number;
  role: string;
}

export interface Node {
  id: string;
  x: number;
  y: number;
  type: string;
  level: number;
  latitude?: number;   // Adicionar opcional
  longitude?: number;  // Adicionar opcional
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  w: number;
}

// Interface POI atualizada com latitude/longitude opcionais
export interface POI {
  id: string;
  name: string;
  category: string;
  node_id?: string;
  x: number;
  y: number;
  level: number;
  latitude?: number;    // ← ADICIONAR AQUI
  longitude?: number;   // ← ADICIONAR AQUI
}

export interface MapData {
  nodes: Node[];
  edges: Edge[];
  pois?: POI[];
  closures?: any[];
  gates?: Gate[];
}

export interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: string;
  location: string; 
}

export interface Gate {
  id: string;
  gate_number: string;
  x: number;
  y: number;
  level: number;
  latitude?: number;    // ← ADICIONAR opcional
  longitude?: number;   // ← ADICIONAR opcional
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
  occupancy_rate?: number;
  area_id?: string;
  heat_level?: 'green' | 'yellow' | 'red';
}

export interface HeatmapPointsResponse {
  timestamp: string;
  points: HeatmapPoint[];
  count: number;
  error?: string;
}

export interface RouteRequest { 
  from_node: string; 
  to_node: string; 
  avoid_crowds?: boolean; 
}

export interface RouteResponse { 
  path: string[]; 
  distance: number; 
  eta_seconds: number; 
  waypoints?: any[]; 
}

export interface CrowdDensity { 
  area_id: string; 
  heat_level: 'green' | 'yellow' | 'red'; 
  occupancy_rate: number; 
}

interface HeatmapApiResponse { 
  timestamp: string; 
  areas: CrowdDensity[]; 
}

// --- Cliente API ---
export const api = {
  login: async (email: string, role: string): Promise<LoginResponse> => {
    try {
      console.log(`🔑 Login como ${role} em ${AUTH_SERVICE}`);
      const response = await axios.post<LoginResponse>(`${AUTH_SERVICE}/auth/login`, {
        username: email,       
        password: "password",
        role: role 
      });
      console.log(`✅ Login realizado como ${role}`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro Login API:", error.message);
      if (__DEV__) {
        console.log("⚠️ Usando fallback de login...");
        return {
          token: "dev-token-" + Date.now(),
          user_id: 1,
          role: role
        };
      }
      throw error;
    }
  },

  getStaff: async (): Promise<StaffMember[]> => {
    try {
      console.log(`👥 Buscando staff de ${AUTH_SERVICE}/auth/staff`);
      const response = await axios.get<StaffMember[]>(`${AUTH_SERVICE}/auth/staff`, {
        timeout: 5000
      });
      console.log(`✅ Staff carregado: ${response.data.length} pessoas`);
      return response.data;
    } catch (error: any) {
      console.warn("⚠️ Erro getStaff:", error.message);
      return [
        { 
          id: 8, 
          name: 'John Doe', 
          role: 'Security', 
          status: 'active', 
          location: 'N1' 
        },
        { 
          id: 9, 
          name: 'Bruno Limpeza', 
          role: 'Cleaning', 
          status: 'working', 
          location: 'N2' 
        },
        { 
          id: 10, 
          name: 'Alice Segurança', 
          role: 'Security', 
          status: 'patrol', 
          location: 'Gate-1' 
        }
      ];
    }
  },

  getMapGraph: async (): Promise<MapData> => {
    try {
      console.log(`📍 A buscar mapa de: ${MAP_SERVICE}/api/map`);
      const response = await axios.get<MapData>(`${MAP_SERVICE}/api/map`, {
        timeout: 10000
      });
      
      console.log(`✅ Mapa carregado: ${response.data.nodes?.length || 0} nodes`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro getMapGraph:", error.message);
      
      if (__DEV__) {
        console.log("⚠️ Usando dados de fallback para desenvolvimento...");
        return {
          nodes: [
            { id: "N1", x: 41.161300, y: -8.584500, type: "normal", level: 0 },
            { id: "N2", x: 41.161350, y: -8.584000, type: "normal", level: 0 },
            { id: "N4", x: 41.161450, y: -8.583000, type: "normal", level: 0 },
            { id: "N8", x: 41.161500, y: -8.584500, type: "normal", level: 0 },
            { id: "N10", x: 41.161700, y: -8.582500, type: "normal", level: 0 },
          ],
          edges: [
            { id: "E1", from: "N1", to: "N2", w: 50.0 },
            { id: "E2", from: "N2", to: "N1", w: 50.0 },
          ],
          closures: []
        };
      }
      throw error;
    }
  },

  getPOIs: async (): Promise<POI[]> => {
    try {
      console.log(`📍 A buscar POIs de: ${MAP_SERVICE}/api/pois`);
      const response = await axios.get<POI[]>(`${MAP_SERVICE}/api/pois`, {
        timeout: 5000
      });
      console.log(`✅ POIs carregados: ${response.data.length}`);
      return response.data;
    } catch (error: any) {
      console.warn("⚠️ Erro getPOIs:", error.message);
      return [
        { 
          id: "Bin-1", 
          name: "Recycle Bin A", 
          category: "bin", 
          x: 41.161350, 
          y: -8.584200, 
          level: 0,
          latitude: 41.161350,  // ← Adicionar latitude
          longitude: -8.584200   // ← Adicionar longitude
        },
        { 
          id: "Bin-2", 
          name: "General Waste", 
          category: "bin", 
          x: 41.161450, 
          y: -8.583200, 
          level: 0,
          latitude: 41.161450,  // ← Adicionar latitude
          longitude: -8.583200   // ← Adicionar longitude
        },
        { 
          id: "WC-1", 
          name: "WC South", 
          category: "restroom", 
          x: 41.161600, 
          y: -8.584400, 
          level: 0,
          latitude: 41.161600,  // ← Adicionar latitude
          longitude: -8.584400   // ← Adicionar longitude
        },
      ];
    }
  },

  getGates: async (): Promise<Gate[]> => {
    try {
      console.log(`🚪 Buscando gates de ${MAP_SERVICE}/api/gates`);
      const response = await axios.get<Gate[]>(`${MAP_SERVICE}/api/gates`, {
        timeout: 5000
      });
      console.log(`✅ Gates carregados: ${response.data.length}`);
      return response.data;
    } catch (error: any) {
      console.warn("⚠️ Erro getGates:", error.message);
      return [];
    }
  },

  checkMapServiceHealth: async (): Promise<boolean> => {
    try {
      console.log(`🏥 Health check Map Service: ${MAP_SERVICE}/health`);
      const response = await axios.get(`${MAP_SERVICE}/health`, { 
        timeout: 3000 
      });
      console.log(`✅ Map Service health: ${response.status}`);
      return response.status === 200;
    } catch (error: any) {
      console.warn(`⚠️ Map Service offline: ${error.message}`);
      return false;
    }
  },

  getHeatmapPoints: async (): Promise<HeatmapPointsResponse> => {
    try {
      const url = `${CONGESTION_SERVICE}/api/heatmap/points`;
      console.log(`🔥 Buscando heatmap de: ${url}`);
      
      const response = await axios.get<HeatmapPointsResponse>(url, { 
        timeout: 10000
      });
      
      console.log(`✅ Heatmap points recebidos: ${response.data.points?.length || 0} pontos`);
      console.log(`📊 Timestamp: ${response.data.timestamp}`);
      
      // Validar os dados
      const validPoints = (response.data.points || []).filter(point => 
        point.latitude && point.longitude && 
        Math.abs(point.latitude) > 0 && Math.abs(point.longitude) > 0
      );
      
      if (validPoints.length !== response.data.points?.length) {
        console.warn(`⚠️ Filtrados ${(response.data.points?.length || 0) - validPoints.length} pontos inválidos`);
      }
      
      return {
        ...response.data,
        points: validPoints,
        count: validPoints.length
      };
      
    } catch (error: any) {
      console.error("❌ Erro ao buscar heatmap points:", error.message);
      
      if (__DEV__) {
        console.log("⚠️ Retornando dados mock para desenvolvimento...");
        return {
          timestamp: new Date().toISOString(),
          points: [
            {
              latitude: 41.161350,
              longitude: -8.584200,
              weight: 0.8,
              occupancy_rate: 85.5,
              area_id: "TEST-1",
              heat_level: "red"
            },
            {
              latitude: 41.161450,
              longitude: -8.583200,
              weight: 0.4,
              occupancy_rate: 45.2,
              area_id: "TEST-2",
              heat_level: "yellow"
            },
            {
              latitude: 41.161550,
              longitude: -8.583500,
              weight: 0.6,
              occupancy_rate: 65.3,
              area_id: "TEST-3",
              heat_level: "yellow"
            }
          ],
          count: 3
        };
      }
      
      return {
        timestamp: new Date().toISOString(),
        points: [],
        count: 0,
        error: error.message
      };
    }
  },

  getHeatmap: async (): Promise<CrowdDensity[]> => {
    try {
      console.log(`📊 Buscando heatmap de ${CONGESTION_SERVICE}/api/heatmap`);
      const response = await axios.get<HeatmapApiResponse>(`${CONGESTION_SERVICE}/api/heatmap`, {
        timeout: 5000
      });
      console.log(`✅ Heatmap carregado: ${response.data.areas?.length || 0} áreas`);
      return response.data.areas || [];
    } catch (error: any) {
      console.warn("⚠️ Erro getHeatmap:", error.message);
      return [];
    }
  },

  calculateRoute: async (req: RouteRequest): Promise<RouteResponse> => {
    try {
      console.log(`📍 Calculando rota: ${req.from_node} → ${req.to_node}`);
      const response = await axios.post<RouteResponse>(`${ROUTING_SERVICE}/api/route`, req, {
        timeout: 10000
      });
      console.log(`✅ Rota calculada: ${response.data.path.length} nós, ${response.data.distance}m`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro calculateRoute:", error.message);
      throw error;
    }
  },

  checkCongestionServiceHealth: async (): Promise<boolean> => {
    try {
      console.log(`🏥 Health check Congestion Service: ${CONGESTION_SERVICE}/`);
      const response = await axios.get(`${CONGESTION_SERVICE}/`, { 
        timeout: 3000 
      });
      console.log(`✅ Congestion Service health: ${response.status}`);
      return response.status === 200;
    } catch (error: any) {
      console.warn(`⚠️ Congestion Service offline: ${error.message}`);
      return false;
    }
  }
};