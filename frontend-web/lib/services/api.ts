/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";

// Base paths (via Next rewrites)
export const AUTH_BASE = process.env.NEXT_PUBLIC_API_AUTH || "/api/auth";
export const MAP_BASE = process.env.NEXT_PUBLIC_API_MAP || "/api/map";
export const ROUTE_BASE = process.env.NEXT_PUBLIC_API_ROUTING || "/api/routing";
export const CONGESTION_BASE = process.env.NEXT_PUBLIC_API_CONGESTION || "/api/congestion";
export const EMERGENCY_BASE = process.env.NEXT_PUBLIC_API_EMERGENCY || "/api/emergency";
export const MAINTENANCE_BASE = process.env.NEXT_PUBLIC_API_MAINTENANCE || "/api/maintenance";
export const QUEUEING_BASE = process.env.NEXT_PUBLIC_API_QUEUEING || "/api/queueing";
export const CHAT_BASE = process.env.NEXT_PUBLIC_API_CHAT || "/api/chat";

// Aliases para compatibilidade com imports antigos (não usar IPs; continua via rewrites)
export const AUTH_SERVICE = AUTH_BASE;
export const MAP_SERVICE = MAP_BASE;
export const ROUTING_SERVICE = ROUTE_BASE; // ou ROUTING_BASE se estiveres a usar esse nome
export const CONGESTION_SERVICE = CONGESTION_BASE;
export const EMERGENCY_SERVICE = EMERGENCY_BASE;
export const MAINTENANCE_SERVICE = MAINTENANCE_BASE;
export const QUEUEING_SERVICE = QUEUEING_BASE;
export const CHAT_SERVICE = CHAT_BASE;
// WS does not use rewrites
export const WS_GATEWAY =
  process.env.NEXT_PUBLIC_WS_GATEWAY ||
  process.env.NEXT_PUBLIC_WS_URL ||
  "ws://localhost:8089/ws";

function getToken(): string {
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.token || "";
  } catch {
    return "";
  }
}

function bearerHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
  latitude?: number;
  longitude?: number;
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
  latitude?: number;
  longitude?: number;
}

export interface Gate {
  id: string;
  gate_number: string;
  x: number;
  y: number;
  level: number;
  latitude?: number;
  longitude?: number;
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

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
  occupancy_rate?: number;
  area_id?: string;
  heat_level?: "green" | "yellow" | "red";
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
  heat_level: "green" | "yellow" | "red";
  occupancy_rate: number;
}

interface HeatmapApiResponse {
  timestamp: string;
  areas: CrowdDensity[];
}

// --- Cliente API ---
export const api = {
  // ---- AUTH ----
  login: async (
    email: string,
    password: string,
    role: string
  ): Promise<LoginResponse> => {
    const response = await axios.post<LoginResponse>(
      `${AUTH_SERVICE}/login`,
      {
        username: email,   // ou "email" se o backend usar email
        password,
        role,
      },
      { timeout: 5000 }
    );

    return response.data;
  },

  validateToken: async (token: string): Promise<boolean> => {
    try {
      console.log(`🔐 Validando token em ${AUTH_SERVICE}/validate`);
      const response = await axios.post(
        `${AUTH_SERVICE}/validate`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      );
      console.log(`✅ Token válido: ${response.status}`);
      return response.status === 200;
    } catch (error: any) {
      console.error("❌ Erro ao validar token:", error.message);
      if (error.response?.status === 401) return false;
      return false;
    }
  },

  getStaff: async (): Promise<StaffMember[]> => {
    try {
      console.log(`👥 Buscando staff de ${AUTH_SERVICE}/staff`);
      const response = await axios.get<StaffMember[]>(`${AUTH_SERVICE}/staff`, {
        timeout: 5000,
        headers: { ...bearerHeader() },
      });
      console.log(`✅ Staff carregado: ${response.data.length} pessoas`);
      return response.data;
    } catch (error: any) {
      console.warn("⚠️ Erro getStaff:", error.message);
      return [
        { id: 8, name: "João Silva", role: "Security", status: "active", location: "N1" },
        { id: 9, name: "Maria Santos", role: "Cleaning", status: "active", location: "N2" },
        { id: 10, name: "Ana Oliveira", role: "Security", status: "patrol", location: "N4" },
        { id: 11, name: "Pedro Costa", role: "Supervisor", status: "active", location: "VIP" },
        { id: 12, name: "Carlos Rodrigues", role: "Medical", status: "break", location: "N7" },
      ];
    }
  },

  // ---- MAP ----
  // ✅ como o rewrite já mete /api/ no destino, aqui NÃO usamos /api/...
  getMapGraph: async (): Promise<MapData> => {
    try {
      console.log(`📍 A buscar mapa de: ${MAP_SERVICE}/map`);
      const response = await axios.get<MapData>(`${MAP_SERVICE}/map`, {
        timeout: 10000,
        headers: { ...bearerHeader() },
      });
      console.log(`✅ Mapa carregado: ${response.data.nodes?.length || 0} nodes`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro getMapGraph:", error.message);

      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Usando dados de fallback para desenvolvimento...");
        return {
          nodes: [
            { id: "N1", x: 41.1613, y: -8.5845, type: "normal", level: 0 },
            { id: "N2", x: 41.16135, y: -8.584, type: "normal", level: 0 },
            { id: "N4", x: 41.16145, y: -8.583, type: "normal", level: 0 },
            { id: "N8", x: 41.1615, y: -8.5845, type: "normal", level: 0 },
            { id: "N10", x: 41.1617, y: -8.5825, type: "normal", level: 0 },
          ],
          edges: [
            { id: "E1", from: "N1", to: "N2", w: 50.0 },
            { id: "E2", from: "N2", to: "N1", w: 50.0 },
          ],
          closures: [],
        };
      }
      throw error;
    }
  },

  getPOIs: async (): Promise<POI[]> => {
    try {
      console.log(`📍 A buscar POIs de: ${MAP_SERVICE}/pois`);
      const response = await axios.get<POI[]>(`${MAP_SERVICE}/pois`, {
        timeout: 5000,
        headers: { ...bearerHeader() },
      });
      console.log(`✅ POIs carregados: ${response.data.length}`);
      return response.data;
    } catch (error: any) {
      console.warn("⚠️ Erro getPOIs:", error.message);
      return [
        { id: "Bin-1", name: "Recycle Bin A", category: "bin", x: 41.16135, y: -8.5842, level: 0, latitude: 41.16135, longitude: -8.5842 },
        { id: "Bin-2", name: "General Waste", category: "bin", x: 41.16145, y: -8.5832, level: 0, latitude: 41.16145, longitude: -8.5832 },
        { id: "WC-1", name: "WC South", category: "restroom", x: 41.1616, y: -8.5844, level: 0, latitude: 41.1616, longitude: -8.5844 },
      ];
    }
  },

  getGates: async (): Promise<Gate[]> => {
    try {
      console.log(`🚪 Buscando gates de ${MAP_SERVICE}/gates`);
      const response = await axios.get<Gate[]>(`${MAP_SERVICE}/gates`, {
        timeout: 5000,
        headers: { ...bearerHeader() },
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
      // Map service does not expose /api/health through current rewrite.
      // Using /map as a lightweight availability check for frontend flow.
      console.log(`🏥 Health check Map Service: ${MAP_SERVICE}/map`);
      const response = await axios.get(`${MAP_SERVICE}/map`, { timeout: 3000 });
      console.log(`✅ Map Service health: ${response.status}`);
      return response.status === 200;
    } catch (error: any) {
      console.warn(`⚠️ Map Service offline: ${error.message}`);
      return false;
    }
  },

  // ---- CONGESTION ----
  // ✅ rewrite já mete /api/ no destino, então aqui NÃO usamos /api/...
  getHeatmapPoints: async (): Promise<HeatmapPointsResponse> => {
    try {
      const url = `${CONGESTION_SERVICE}/heatmap/points`;
      console.log(`🔥 Buscando heatmap de: ${url}`);

      const response = await axios.get<HeatmapPointsResponse>(url, {
        timeout: 10000,
        headers: { ...bearerHeader() },
      });

      const validPoints = (response.data.points || []).filter(
        (p) => p.latitude && p.longitude && Math.abs(p.latitude) > 0 && Math.abs(p.longitude) > 0
      );

      if (validPoints.length !== (response.data.points?.length || 0)) {
        console.warn(`⚠️ Filtrados ${(response.data.points?.length || 0) - validPoints.length} pontos inválidos`);
      }

      return { ...response.data, points: validPoints, count: validPoints.length };
    } catch (error: any) {
      console.error("❌ Erro ao buscar heatmap points:", error.message);

      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Retornando dados mock para desenvolvimento...");
        return {
          timestamp: new Date().toISOString(),
          points: [
            { latitude: 41.16135, longitude: -8.5842, weight: 0.8, occupancy_rate: 85.5, area_id: "TEST-1", heat_level: "red" },
            { latitude: 41.16145, longitude: -8.5832, weight: 0.4, occupancy_rate: 45.2, area_id: "TEST-2", heat_level: "yellow" },
            { latitude: 41.16155, longitude: -8.5835, weight: 0.6, occupancy_rate: 65.3, area_id: "TEST-3", heat_level: "yellow" },
          ],
          count: 3,
        };
      }

      return { timestamp: new Date().toISOString(), points: [], count: 0, error: error.message };
    }
  },

  getHeatmap: async (): Promise<CrowdDensity[]> => {
    try {
      console.log(`📊 Buscando heatmap de ${CONGESTION_SERVICE}/heatmap`);
      const response = await axios.get<HeatmapApiResponse>(`${CONGESTION_SERVICE}/heatmap`, {
        timeout: 5000,
        headers: { ...bearerHeader() },
      });
      console.log(`✅ Heatmap carregado: ${response.data.areas?.length || 0} áreas`);
      return response.data.areas || [];
    } catch (error: any) {
      console.warn("⚠️ Erro getHeatmap:", error.message);
      return [];
    }
  },

  checkCongestionServiceHealth: async (): Promise<boolean> => {
    try {
      console.log(`🏥 Health check Congestion Service: ${CONGESTION_SERVICE}/`);
      const response = await axios.get(`${CONGESTION_SERVICE}/`, { timeout: 3000 });
      console.log(`✅ Congestion Service health: ${response.status}`);
      return response.status === 200;
    } catch (error: any) {
      console.warn(`⚠️ Congestion Service offline: ${error.message}`);
      return false;
    }
  },

  // ---- ROUTING ----
  // ✅ rewrite é /api/route -> destino já mete /api/
  // então aqui NÃO usamos /api/...
  calculateRoute: async (req: RouteRequest): Promise<RouteResponse> => {
    try {
      console.log(`📍 Calculando rota: ${req.from_node} → ${req.to_node}`);
      const response = await axios.post<RouteResponse>(`${ROUTING_SERVICE}/route`, req, {
        timeout: 10000,
        headers: { ...bearerHeader() },
      });
      console.log(`✅ Rota calculada: ${response.data.path.length} nós, ${response.data.distance}m`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro calculateRoute:", error.message);
      throw error;
    }
  },

  // ---- EMERGENCY ----
  getIncidentDetails: async (incidentId: string) => {
    console.log(`📋 Buscando detalhes do incidente ${incidentId} em ${EMERGENCY_SERVICE}/incidents/${incidentId}`);
    const response = await axios.get(`${EMERGENCY_SERVICE}/incidents/${incidentId}`, {
      timeout: 5000,
      headers: { ...bearerHeader() },
    });
    return response.data;
  },

  acceptIncident: async (incidentId: string, userId?: number) => {
    console.log(`✅ Aceitando incidente ${incidentId} em ${EMERGENCY_SERVICE}/incidents/${incidentId}/accept`);
    const response = await axios.post(
      `${EMERGENCY_SERVICE}/incidents/${incidentId}/accept`,
      { userId },
      { timeout: 5000, headers: { ...bearerHeader() } }
    );
    return response.data;
  },

  // ---- MAINTENANCE ----
  getTaskDetails: async (taskId: string) => {
    console.log(`📋 Buscando detalhes da tarefa ${taskId} em ${MAINTENANCE_SERVICE}/tasks/${taskId}`);
    const response = await axios.get(`${MAINTENANCE_SERVICE}/tasks/${taskId}`, {
      timeout: 5000,
      headers: { ...bearerHeader() },
    });
    return response.data;
  },

  updateTaskStatus: async (
    taskId: string,
    status: "pending" | "in-progress" | "completed" | "cancelled"
  ) => {
    console.log(`✅ Atualizando status da tarefa ${taskId} para ${status}`);
    const response = await axios.put(
      `${MAINTENANCE_SERVICE}/tasks/${taskId}/status`,
      { status },
      { timeout: 5000, headers: { ...bearerHeader() } }
    );
    return response.data;
  },

  updateTaskChecklist: async (taskId: string, checklist: any[]) => {
    console.log(`✅ Atualizando checklist da tarefa ${taskId}`);
    const response = await axios.put(
      `${MAINTENANCE_SERVICE}/tasks/${taskId}/checklist`,
      { checklist },
      { timeout: 5000, headers: { ...bearerHeader() } }
    );
    return response.data;
  },

  // ---- PROFILE (mantive como tinhas; depende do backend) ----
  getProfileStats: async (userId: number) => {
    return axios.get(`${AUTH_SERVICE}/users/${userId}/stats`, {
      headers: { ...bearerHeader() },
      timeout: 5000,
    });
  },

  getRecentActivity: async (userId: number) => {
    return axios.get(`${AUTH_SERVICE}/users/${userId}/activity`, {
      headers: { ...bearerHeader() },
      timeout: 5000,
    });
  },

  updateUserPreferences: async (userId: number, preferences: any) => {
    return axios.put(`${AUTH_SERVICE}/users/${userId}/preferences`, preferences, {
      headers: { ...bearerHeader() },
      timeout: 5000,
    });
  },

  updateDutyStatus: async (userId: number, status: boolean) => {
    return axios.put(
      `${AUTH_SERVICE}/users/${userId}/duty`,
      { onDuty: status },
      { headers: { ...bearerHeader() }, timeout: 5000 }
    );
  },
};
