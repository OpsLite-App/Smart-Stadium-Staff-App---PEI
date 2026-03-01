/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

// Usar variável de ambiente do Next.js
export const LOCAL_IP = process.env.NEXT_PUBLIC_API_IP || '192.168.1.137';

console.log(`📡 API Config:`);
console.log(`   • Ambiente: ${process.env.NODE_ENV === 'development' ? 'Desenvolvimento' : 'Produção'}`);
console.log(`   • Plataforma: web`);
console.log(`   • IP Local: ${LOCAL_IP}`);

// --- URLs DOS SERVIÇOS ---

// Usar URLs completas com o IP:
export const AUTH_SERVICE = `http://${LOCAL_IP}:8002`;
export const MAP_SERVICE = `http://${LOCAL_IP}:8003`;
export const ROUTING_SERVICE = `http://${LOCAL_IP}:8004`;
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
  latitude?: number;
  longitude?: number;
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
      }, {
        timeout: 5000
      });
      console.log(`✅ Login realizado como ${role}`);
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro Login API:", error.message);
      if (process.env.NODE_ENV === 'development') {
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

  validateToken: async (token: string): Promise<boolean> => {
    try {
      console.log(`🔐 Validando token em ${AUTH_SERVICE}/auth/validate`);
      
      const response = await axios.post(`${AUTH_SERVICE}/auth/validate`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 5000
      });
      
      console.log(`✅ Token válido: ${response.status}`);
      return response.status === 200;
      
    } catch (error: any) {
      console.error("❌ Erro ao validar token:", error.message);
      
      if (error.response?.status === 401) {
        console.log("⏰ Token expirado ou inválido");
        return false;
      }
      
      console.log("⚠️ Erro na validação, considerando token inválido");
      return false;
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
    
    // 🟢 DADOS MOCK CORRIGIDOS - usar apenas locations que existem nos nodes mock
    return [
      { 
        id: 8, 
        name: 'João Silva', 
        role: 'Security', 
        status: 'active', 
        location: 'N1'  // ✅ Existe nos nodes mock
      },
      { 
        id: 9, 
        name: 'Maria Santos', 
        role: 'Cleaning', 
        status: 'active', 
        location: 'N2'  // ✅ Existe nos nodes mock
      },
      { 
        id: 10, 
        name: 'Ana Oliveira', 
        role: 'Security', 
        status: 'patrol', 
        location: 'N4'  // ✅ Existe nos nodes mock
      },
      { 
        id: 11, 
        name: 'Pedro Costa', 
        role: 'Supervisor', 
        status: 'active', 
        location: 'VIP'  // ✅ Existe nos nodes mock
      },
      { 
        id: 12, 
        name: 'Carlos Rodrigues', 
        role: 'Medical', 
        status: 'break', 
        location: 'N7'  // ✅ Existe nos nodes mock
      },
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
      
      if (process.env.NODE_ENV === 'development') {
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
          latitude: 41.161350,
          longitude: -8.584200
        },
        { 
          id: "Bin-2", 
          name: "General Waste", 
          category: "bin", 
          x: 41.161450, 
          y: -8.583200, 
          level: 0,
          latitude: 41.161450,
          longitude: -8.583200
        },
        { 
          id: "WC-1", 
          name: "WC South", 
          category: "restroom", 
          x: 41.161600, 
          y: -8.584400, 
          level: 0,
          latitude: 41.161600,
          longitude: -8.584400
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
      
      if (process.env.NODE_ENV === 'development') {
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
  // Adicionar ao api.ts:

  // Adicionar dentro do objeto api, antes da última chave }

  // Incidentes
  getIncidentDetails: async (incidentId: string) => {
    try {
      console.log(`📋 Buscando detalhes do incidente ${incidentId} em ${EMERGENCY_SERVICE}/api/incidents/${incidentId}`);
      const response = await axios.get(`${EMERGENCY_SERVICE}/api/incidents/${incidentId}`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.user?.token : ''}`
        }
      });
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro ao buscar detalhes do incidente:", error.message);
      throw error;
    }
  },

  acceptIncident: async (incidentId: string, userId?: number) => {
    try {
      console.log(`✅ Aceitando incidente ${incidentId} em ${EMERGENCY_SERVICE}/api/incidents/${incidentId}/accept`);
      const response = await axios.post(`${EMERGENCY_SERVICE}/api/incidents/${incidentId}/accept`, 
        { userId },
        {
          timeout: 5000,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.user?.token : ''}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro ao aceitar incidente:", error.message);
      throw error;
    }
  },

  // Tarefas
  getTaskDetails: async (taskId: string) => {
    try {
      console.log(`📋 Buscando detalhes da tarefa ${taskId} em ${MAINTENANCE_SERVICE}/api/tasks/${taskId}`);
      const response = await axios.get(`${MAINTENANCE_SERVICE}/api/tasks/${taskId}`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.user?.token : ''}`
        }
      });
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro ao buscar detalhes da tarefa:", error.message);
      throw error;
    }
  },

  updateTaskStatus: async (taskId: string, status: 'pending' | 'in-progress' | 'completed' | 'cancelled') => {
    try {
      console.log(`✅ Atualizando status da tarefa ${taskId} para ${status}`);
      const response = await axios.put(`${MAINTENANCE_SERVICE}/api/tasks/${taskId}/status`, 
        { status },
        {
          timeout: 5000,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.user?.token : ''}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro ao atualizar status da tarefa:", error.message);
      throw error;
    }
  },

  updateTaskChecklist: async (taskId: string, checklist: any[]) => {
    try {
      console.log(`✅ Atualizando checklist da tarefa ${taskId}`);
      const response = await axios.put(`${MAINTENANCE_SERVICE}/api/tasks/${taskId}/checklist`, 
        { checklist },
        {
          timeout: 5000,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')!).state?.user?.token : ''}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("❌ Erro ao atualizar checklist:", error.message);
      throw error;
    }
  },
getProfileStats: async (userId: number) => {
  return axios.get(`${AUTH_SERVICE}/users/${userId}/stats`);
},

getRecentActivity: async (userId: number) => {
  return axios.get(`${AUTH_SERVICE}/users/${userId}/activity`);
},

updateUserPreferences: async (userId: number, preferences: any) => {
  return axios.put(`${AUTH_SERVICE}/users/${userId}/preferences`, preferences);
},

updateDutyStatus: async (userId: number, status: boolean) => {
  return axios.put(`${AUTH_SERVICE}/users/${userId}/duty`, { onDuty: status });
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