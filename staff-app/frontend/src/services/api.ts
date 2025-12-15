import axios from 'axios';
import Constants from 'expo-constants';

// --- LÓGICA DE IP AUTOMÁTICO ---
const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
const LOCAL_IP = debuggerHost?.split(':').shift() || '192.168.1.137'; // O teu fallback

console.log(`📡 A conectar ao servidor em: ${LOCAL_IP}`);

const AUTH_SERVICE = `http://${LOCAL_IP}:8081`;
const MAP_SERVICE = `http://${LOCAL_IP}:8000`;
const ROUTING_SERVICE = `http://${LOCAL_IP}:8002`;
const CONGESTION_SERVICE = `http://${LOCAL_IP}:8005`;

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
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  w: number;
}

export interface POI {
  id: string;
  name: string;
  category: string;
  node_id?: string;
  x: number;
  y: number;
  level: number;
}

export interface MapData {
  nodes: Node[];
  edges: Edge[];
  pois?: POI[];
  closures?: any[];
}

export interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: string;
  location: string; 
}

// Interfaces de Rota e Heatmap
export interface RouteRequest { from_node: string; to_node: string; avoid_crowds?: boolean; }
export interface RouteResponse { path: string[]; distance: number; eta_seconds: number; waypoints?: any[]; }
export interface CrowdDensity { area_id: string; heat_level: 'green' | 'yellow' | 'red'; occupancy_rate: number; }
interface HeatmapApiResponse { timestamp: string; areas: CrowdDensity[]; }
export interface HeatmapPoint { latitude: number; longitude: number; weight: number; }

// --- Cliente API ---

export const api = {
  // Login
  login: async (email: string, role: string): Promise<LoginResponse> => {
    try {
      const response = await axios.post<LoginResponse>(`${AUTH_SERVICE}/auth/login`, {
        username: email,       
        password: "password",
        role: role 
      });
      return response.data;
    } catch (error) {
      console.error("❌ Erro Login API:", error);
      throw error;
    }
  },

  // --- Procurar Colegas (Staff) ---
  getStaff: async (): Promise<StaffMember[]> => {
    try {
      const response = await axios.get<StaffMember[]>(`${AUTH_SERVICE}/auth/staff`);
      return response.data;
    } catch (error) {
      console.warn("⚠️ Backend ainda não tem endpoint /auth/staff. A ignorar...");
      return [];
    }
  },

  // Mapas
  getMapGraph: async (): Promise<MapData> => {
    try {
      const response = await axios.get<MapData>(`${MAP_SERVICE}/api/map`);
      return response.data;
    } catch (error) {
      console.error("❌ Erro getMapGraph:", error);
      throw error;
    }
  },

  getPOIs: async (): Promise<POI[]> => {
    try {
      const response = await axios.get<POI[]>(`${MAP_SERVICE}/api/pois`);
      return response.data;
    } catch (error) {
      return [];
    }
  },

  // Heatmap
  getHeatmap: async (): Promise<CrowdDensity[]> => {
    try {
      const response = await axios.get<HeatmapApiResponse>(`${CONGESTION_SERVICE}/api/heatmap`);
      return response.data.areas || [];
    } catch (error) {
      return [];
    }
  },

  // Rota
  calculateRoute: async (req: RouteRequest): Promise<RouteResponse> => {
    try {
      const response = await axios.post<RouteResponse>(`${ROUTING_SERVICE}/api/route`, req);
      return response.data;
    } catch (error) {
      console.error("❌ Erro calculateRoute:", error);
      throw error;
    }
  }
};