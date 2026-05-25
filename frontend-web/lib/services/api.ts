/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import type { PermissionSet } from "@/lib/auth/rbac";

// Base paths (via Next rewrites)
export const AUTH_BASE = process.env.NEXT_PUBLIC_API_AUTH || "/api/auth";
export const CONGESTION_BASE = process.env.NEXT_PUBLIC_API_CONGESTION || "/api/congestion";
export const EMERGENCY_BASE = process.env.NEXT_PUBLIC_API_EMERGENCY || "/api/emergency";
export const MAINTENANCE_BASE = process.env.NEXT_PUBLIC_API_MAINTENANCE || "/api/maintenance";
export const QUEUEING_BASE = process.env.NEXT_PUBLIC_API_QUEUEING || "/api/queueing";
export const CHAT_BASE = process.env.NEXT_PUBLIC_API_CHAT || "/api/chat";
export const ROUTING_BASE = process.env.NEXT_PUBLIC_API_ROUTING || '/api/routing';
export const ROUTING_SERVICE = ROUTING_BASE;

export const POSITIONING_BASE = process.env.NEXT_PUBLIC_API_POSITIONING || "/api/positioning";
export const AUTH_SERVICE = AUTH_BASE;
export const CONGESTION_SERVICE = CONGESTION_BASE;
export const EMERGENCY_SERVICE = EMERGENCY_BASE;
export const MAINTENANCE_SERVICE = MAINTENANCE_BASE;
export const QUEUEING_SERVICE = QUEUEING_BASE;
export const CHAT_SERVICE = CHAT_BASE;
function resolveWsGateway() {
  const configured =
    process.env.NEXT_PUBLIC_WS_GATEWAY ||
    process.env.NEXT_PUBLIC_WS_URL ||
    "ws://localhost:8089/ws";

  if (typeof window === "undefined") return configured;

  // When the app is opened from a phone, localhost points to the phone itself.
  // Keep local desktop behaviour, but rewrite localhost WS URLs to the current host.
  if (configured.includes("localhost") || configured.includes("127.0.0.1")) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:8089/ws`;
  }

  return configured;
}

// WS does not use Next rewrites, so it must target the machine serving the app.
export const WS_GATEWAY = resolveWsGateway();

// ✅ REMOVED: authToken variable (no longer needed - cookie is used)
// ✅ KEPT: authAxios with withCredentials: true (sends cookie automatically)
const authAxios = axios.create({ withCredentials: true, timeout: 5000 });

// ✅ REMOVED: setAuthToken function
// ✅ REMOVED: bearerHeader function - cookie is sent automatically via authAxios

// --- Interfaces de Dados ---
export interface LoginResponse {
  // ✅ REMOVED: token: string; - Token is now only in HttpOnly cookie
  user_id: number;
  role: string;
  email?: string;
  username?: string;
  permissions?: Partial<PermissionSet>;
}

export interface TokenClaims {
  user_id: number;
  username: string;
  role: string;
  exp: number;
}

export interface StaffPosition {
  staff_id: string;
  x: number;
  y: number;
  zone: string;
  location_id: string;
  confidence: number;
  updated_at: string;
}

// Linear mapping from stadium map coords (x,y) to lat/lng
// Calibrated from NODE_COORDS: x∈[0,300] → lng∈[-8.5847,-8.5827], y∈[0,200] → lat∈[41.1608,41.1623]
export function mapCoordsToLatLng(x: number, y: number): [number, number] {
  const lat = 41.1608 + (y / 200) * (41.1623 - 41.1608);
  const lng = -8.5847 + (x / 300) * (-8.5827 - (-8.5847));
  return [lat, lng];
}

export interface StaffMember {
  id: number;
  name: string;
  role: string;
  status: string;
  location: string;
}

export interface GlobalEvacuation {
  id?: string;
  active: boolean;
  status?: string;
  title?: string;
  description?: string | null;
  emergency_type?: string;
  severity?: string;
  source_node?: string;
  floor_id?: number | null;
  exit_node?: string;
  affected_nodes?: string[];
  affected_zones?: string[];
  instructions?: string | null;
  initiated_at?: string;
  completed_at?: string | null;
  evacuated_count?: number;
  confirmations?: Record<string, unknown>;
}

export interface CreateGlobalEvacuationPayload {
  title: string;
  description?: string;
  emergency_type: string;
  severity: string;
  source_node: string;
  floor_id?: number;
  affected_nodes: string[];
  affected_zones: string[];
  instructions?: string;
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
  login: async (email: string, password: string, role: string): Promise<LoginResponse> => {
    const response = await authAxios.post<LoginResponse>(
      `${AUTH_SERVICE}/login`,
      { username: email, password, role }
    );
    // ✅ REMOVED: setAuthToken(response.data.token) - Token is in cookie only
    return response.data;
  },

  me: async (): Promise<LoginResponse> => {
    const response = await authAxios.get<LoginResponse>(`${AUTH_SERVICE}/me`);
    // ✅ REMOVED: setAuthToken(response.data.token) - Token is in cookie only
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await authAxios.post(`${AUTH_SERVICE}/logout`, {});
    } finally {
      // ✅ REMOVED: setAuthToken("") - No longer needed
    }
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

  validateTokenClaims: async (token: string): Promise<TokenClaims | null> => {
    try {
      const response = await axios.post<TokenClaims>(
        `${AUTH_SERVICE}/validate`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  },

  getStaff: async (): Promise<StaffMember[]> => {
    try {
      console.log(`👥 Buscando staff de ${AUTH_SERVICE}/staff`);
      // ✅ REMOVED: headers: { ...bearerHeader() } - cookie is sent automatically
      const response = await authAxios.get<StaffMember[]>(`${AUTH_SERVICE}/staff`, {
        timeout: 5000,
      });
      console.log(`✅ Staff carregado: ${response.data.length} pessoas`);
      return response.data;
    } catch (error: any) {
      console.warn("⚠️ Erro getStaff:", error.message);
      return [
        { id: 8, name: "João Silva", role: "Security", status: "active", location: "62" },
        { id: 9, name: "Maria Santos", role: "Cleaning", status: "active", location: "70" },
        { id: 10, name: "Ana Oliveira", role: "Security", status: "patrol", location: "66" },
        { id: 11, name: "Pedro Costa", role: "Supervisor", status: "active", location: "VIP" },
        { id: 12, name: "Carlos Rodrigues", role: "Medical", status: "break", location: "1" },
      ];
    }
  },

  // ---- CONGESTION ----
  getHeatmapPoints: async (params?: { floorId?: number }): Promise<HeatmapPointsResponse> => {
    try {
      const url = `${CONGESTION_SERVICE}/heatmap/points`;
      console.log(`🔥 Buscando heatmap de: ${url} com params:`, params);

      // ✅ CHANGED: Use authAxios instead of axios to send cookie
      const response = await authAxios.get<HeatmapPointsResponse>(url, {
        params: params ? { floor_id: params.floorId } : undefined,
        timeout: 10000,
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

      return { timestamp: new Date().toISOString(), points: [], count: 0, error: error.message };
    }
  },

  getHeatmap: async (): Promise<CrowdDensity[]> => {
    try {
      console.log(`📊 Buscando heatmap de ${CONGESTION_SERVICE}/heatmap`);
      // ✅ CHANGED: Use authAxios instead of axios
      const response = await authAxios.get<HeatmapApiResponse>(`${CONGESTION_SERVICE}/heatmap`, {
        timeout: 5000,
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

  // ---- EMERGENCY ----
  getIncidentDetails: async (incidentId: string) => {
    console.log(`📋 Buscando detalhes do incidente ${incidentId} em ${EMERGENCY_SERVICE}/incidents/${incidentId}`);
    // ✅ CHANGED: Use authAxios instead of axios
    const response = await authAxios.get(`${EMERGENCY_SERVICE}/incidents/${incidentId}`, {
      timeout: 5000,
    });
    return response.data;
  },

  getActiveGlobalEvacuation: async (): Promise<GlobalEvacuation> => {
    const response = await authAxios.get<GlobalEvacuation>(`${EMERGENCY_SERVICE}/evacuation/global/active`, {
      timeout: 5000,
    });
    return response.data;
  },

  createGlobalEvacuation: async (payload: CreateGlobalEvacuationPayload): Promise<GlobalEvacuation> => {
    const response = await authAxios.post<GlobalEvacuation>(`${EMERGENCY_SERVICE}/evacuation/global`, payload, {
      timeout: 8000,
    });
    return response.data;
  },

  markEvacuationSafe: async (evacuationId: string, currentNode?: string, notes?: string): Promise<GlobalEvacuation> => {
    const response = await authAxios.post<GlobalEvacuation>(
      `${EMERGENCY_SERVICE}/evacuation/global/${evacuationId}/safe`,
      { current_node: currentNode || undefined, notes },
      { timeout: 5000 }
    );
    return response.data;
  },

  completeGlobalEvacuation: async (evacuationId: string): Promise<GlobalEvacuation> => {
    const response = await authAxios.post<GlobalEvacuation>(
      `${EMERGENCY_SERVICE}/evacuation/global/${evacuationId}/complete`,
      {},
      { timeout: 8000 }
    );
    return response.data;
  },

  getEvacuationRouteGeoJson: async (fromNode: string) => {
    const response = await authAxios.get(`${ROUTING_BASE}/route/evacuation/geojson`, {
      params: { from_node: fromNode },
      timeout: 8000,
    });
    return response.data.route;
  },

  // ---- MAINTENANCE ----
  getBinAlerts: async (): Promise<any[]> => {
    console.log(`📋 Buscando alertas de lixeiras em ${MAINTENANCE_SERVICE}/bins/alerts`);
    const response = await authAxios.get(`${MAINTENANCE_SERVICE}/bins/alerts`, {
      timeout: 5000,
    });
    return response.data;
  },

  getTaskDetails: async (taskId: string) => {
    console.log(`📋 Buscando detalhes da tarefa ${taskId} em ${MAINTENANCE_SERVICE}/tasks/${taskId}`);
    // ✅ CHANGED: Use authAxios instead of axios
    const response = await authAxios.get(`${MAINTENANCE_SERVICE}/tasks/${taskId}`, {
      timeout: 5000,
    });
    return response.data;
  },

  updateTaskStatus: async (
    taskId: string,
    status: "pending" | "assigned" | "in_progress" | "in-progress" | "completed" | "cancelled"
  ) => {
    const backendStatus = status === "in-progress" ? "in_progress" : status;
    console.log(`✅ Atualizando status da tarefa ${taskId} para ${backendStatus}`);
    // ✅ CHANGED: Use authAxios instead of axios
    const response = await authAxios.patch(
      `${MAINTENANCE_SERVICE}/tasks/${taskId}`,
      { status: backendStatus },
      { timeout: 5000 }
    );
    return response.data;
  },

  registerStaffForMaintenance: async (staffId: string, name: string, role: string, location?: string) => {
    try {
      const normalizedRole = role.toLowerCase();
      const currentLocation =
        location ??
        (normalizedRole.includes('clean') ? '70' : normalizedRole.includes('medic') ? '1' : '66');
      // ✅ CHANGED: Use authAxios instead of axios
      await authAxios.post(`${MAINTENANCE_BASE}/staff/register`, null, {
        params: { staff_id: staffId, name, role: normalizedRole, current_location: currentLocation },
        timeout: 5000,
      });
      // Ensure staff is marked available after registration
      await authAxios.patch(`${MAINTENANCE_BASE}/staff/${staffId}/availability`, null, {
        params: { is_available: true },
        timeout: 5000,
      });
    } catch { /* non-critical */ }
  },

  getRoute: async (fromNode: string, toNode: string): Promise<{ path: string[]; waypoints: { node_id: string; x: number; y: number }[]; eta_seconds: number; distance: number }> => {
    // ✅ CHANGED: Use authAxios instead of axios
    const response = await authAxios.get(`${ROUTING_BASE}/route`, {
      params: { from_node: fromNode, to_node: toNode },
      timeout: 8000,
    });
    return response.data;
  },

  // ---- MAINTENANCE TASKS ----
  getMyTasks: async (staffId: string) => {
    const statuses = ['pending', 'assigned', 'in_progress'];
    const results = await Promise.all(
      statuses.map((status) =>
        // ✅ CHANGED: Use authAxios instead of axios
        authAxios.get(`${MAINTENANCE_BASE}/tasks`, {
          params: { assigned_to: staffId, status },
          timeout: 6000,
        }).then(r => r.data?.tasks ?? []).catch(() => [])
      )
    );
    return results.flat();
  },

  completeTask: async (taskId: string, notes?: string) => {
    // ✅ CHANGED: Use authAxios instead of axios
    const response = await authAxios.post(`${MAINTENANCE_BASE}/tasks/${taskId}/complete`, {}, {
      params: notes ? { notes } : undefined,
      timeout: 6000,
    });
    return response.data;
  },

  startTask: async (taskId: string) => {
    // ✅ CHANGED: Use authAxios instead of axios
    const response = await authAxios.post(`${MAINTENANCE_BASE}/tasks/${taskId}/start`, {}, {
      timeout: 6000,
    });
    return response.data;
  },

  refuseTask: async (taskId: string) => {
    return api.updateTaskStatus(taskId, "cancelled");
  },

  acceptDispatch: async (dispatchId: string) => {
    const response = await authAxios.post(`${EMERGENCY_BASE}/dispatch/${dispatchId}/accept`, {}, {
      timeout: 6000,
    });
    return response.data;
  },

  refuseDispatch: async (dispatchId: string) => {
    const response = await authAxios.post(`${EMERGENCY_BASE}/dispatch/${dispatchId}/refuse`, {}, {
      timeout: 6000,
    });
    return response.data;
  },

  completeDispatch: async (dispatchId: string, notes: string) => {
    const response = await authAxios.post(`${EMERGENCY_BASE}/dispatch/${dispatchId}/complete`, {}, {
      params: { notes },
      timeout: 6000,
    });
    return response.data;
  },

  // ---- CROWD & QUEUE ----
  getCrowdSummary: async () => {
    // ✅ CHANGED: Use authAxios instead of axios
    const r = await authAxios.get(`${CONGESTION_BASE}/congestion/summary`, { timeout: 5000 });
    return r.data;
  },

  getCrowdAreas: async () => {
    // ✅ CHANGED: Use authAxios instead of axios
    const r = await authAxios.get(`${CONGESTION_BASE}/heatmap`, { timeout: 5000 });
    return (r.data.areas ?? []) as any[];
  },

  getQueueStatus: async () => {
    // ✅ CHANGED: Use authAxios instead of axios
    const r = await authAxios.get(`${QUEUEING_BASE}/status`, { timeout: 5000 });
    return (r.data.queues ?? []) as any[];
  },

  getStaffPositions: async (staffIds: string[]): Promise<StaffPosition[]> => {
    const results = await Promise.allSettled(
      staffIds.map((id) =>
        // ✅ CHANGED: Use authAxios instead of axios
        authAxios.get<StaffPosition>(`${POSITIONING_BASE}/position/${id}`, { timeout: 3000 })
          .then((r) => r.data)
      )
    );
    return results
      .filter((r): r is PromiseFulfilledResult<StaffPosition> => r.status === "fulfilled")
      .map((r) => r.value);
  },

  getAllStaffPositions: async (): Promise<StaffPosition[]> => {
    try {
      const response = await authAxios.get<StaffPosition[]>(`${POSITIONING_BASE}/positions`, { timeout: 4000 });
      return response.data;
    } catch {
      return [];
    }
  },

};
