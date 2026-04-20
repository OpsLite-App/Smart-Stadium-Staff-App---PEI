import axios from 'axios';
import { ROUTING_BASE } from '@/lib/services/api';

export interface Poi {
  id: number;
  name: string;
  node_id: number;
  floor_id: number;
  category: string;
}

export interface IndoorRouteResponse {
  start_node: number;
  end_node: number;
  path: number[];
  distance: number;
  eta_seconds: number;
  instructions: string[];
}

export interface GraphStatus {
  status: 'healthy' | 'degraded' | 'critical' | string;
  nodes: number;
  edges: number;
  floors: number;
  pois: number;
  blocked_edges: number;
  cost_overrides: number;
  active_alerts: number;
  updated_at: string | null;
}

export const indoorRoutingService = {
  async getPois(): Promise<Poi[]> {
    const response = await axios.get<Poi[]>(`${ROUTING_BASE}/pois`, {
      timeout: 8000,
    });
    return response.data ?? [];
  },

  async getRouteByPoi(fromPoiId: number, toPoiId: number): Promise<IndoorRouteResponse> {
    const response = await axios.get<IndoorRouteResponse>(`${ROUTING_BASE}/route/pgrouting/by-poi`, {
      params: {
        from_poi_id: fromPoiId,
        to_poi_id: toPoiId,
      },
      timeout: 10000,
    });
    return response.data;
  },

  async getGraphStatus(): Promise<GraphStatus> {
    const response = await axios.get<GraphStatus>(`${ROUTING_BASE}/graph/status`, {
      timeout: 8000,
    });
    return response.data;
  },
};
