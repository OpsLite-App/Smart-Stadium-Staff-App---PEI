import axios from 'axios';
import { ROUTING_BASE } from '@/lib/services/api';
import type { GisFeatureCollection, RouteEdgeProperties } from '@/lib/services/gisApi';

export interface Poi {
  id: number;
  label?: string;
  name: string;
  node_id: number;
  floor_id: number;
  category: string;
  room_code?: string | null;
  room_name?: string | null;
  room_type?: string | null;
  isOutdoor?: boolean;
}

export interface IndoorRouteResponse {
  start_node: number;
  end_node: number;
  path: number[];
  distance: number;
  eta_seconds: number;
  instructions: string[];
}

export interface IndoorRouteGeoJsonResponse {
  route: GisFeatureCollection<RouteEdgeProperties>;
  summary: {
    start_node: number;
    end_node: number;
    distance: number;
    eta_seconds: number;
    floors: number[];
    uses_vertical_transition: boolean;
    impacted_edge_count: number;
    impacted_edges: number[];
  };
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

export interface OperationalEvent {
  id: number;
  event_type: string;
  title: string;
  description?: string | null;
  severity: number;
  status: string;
  source: string;
  floor_id?: number | null;
  node_id?: number | null;
  edge_id?: number | null;
  poi_id?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
}

export interface EdgeOverride {
  id: number;
  edge_id: number;
  is_blocked: boolean;
  cost_multiplier: number;
  reason?: string | null;
  source: string;
  severity: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
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

  async getRouteGeoJsonByPoi(fromPoiId: number, toPoiId: number): Promise<IndoorRouteGeoJsonResponse> {
    const response = await axios.get<IndoorRouteGeoJsonResponse>(`${ROUTING_BASE}/route/pgrouting/by-poi/geojson`, {
      params: {
        from_poi_id: fromPoiId,
        to_poi_id: toPoiId,
      },
      timeout: 10000,
    });
    return response.data;
  },

  async getCombinedRoute(fromNode: number, toNode: number): Promise<IndoorRouteResponse> {
    const response = await axios.get<IndoorRouteResponse>(`${ROUTING_BASE}/route/pgrouting/combined`, {
      params: {
        from_node: fromNode,
        to_node: toNode,
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

  async getEvents(): Promise<OperationalEvent[]> {
    const response = await axios.get<OperationalEvent[]>(`${ROUTING_BASE}/graph/events`, {
      timeout: 8000,
    });
    return response.data ?? [];
  },

  async getEdgeOverrides(): Promise<EdgeOverride[]> {
    const response = await axios.get<EdgeOverride[]>(`${ROUTING_BASE}/graph/edge-overrides`, {
      timeout: 8000,
    });
    return response.data ?? [];
  },
};
