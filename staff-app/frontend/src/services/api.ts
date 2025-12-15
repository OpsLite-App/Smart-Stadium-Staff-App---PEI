import axios from 'axios';

// Endereços do Backend (Android Emulator usa 10.0.2.2)
const MAP_SERVICE = 'http://10.0.2.2:8000';
const ROUTING_SERVICE = 'http://10.0.2.2:8002';
const CONGESTION_SERVICE = 'http://10.0.2.2:8005';

// --- Interfaces de Dados ---

export interface Node {
  id: string;
  x: number; // Latitude
  y: number; // Longitude
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
  x: number; // Latitude
  y: number; // Longitude
  level: number;
}

export interface MapData {
  nodes: Node[];
  edges: Edge[];
  pois?: POI[];
  closures?: any[];
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

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

// Cliente API

export const api = {
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
      console.error("❌ Erro getPOIs:", error);
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

  // Calcular Rota
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