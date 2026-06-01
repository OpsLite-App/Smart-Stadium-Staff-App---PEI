import axios from "axios";

export const GIS_BASE = process.env.NEXT_PUBLIC_API_GIS || "/api/gis";

export type GisGeometryType = "Point" | "LineString" | "Polygon" | "MultiPolygon";

export interface GisGeometry {
  type: GisGeometryType;
  coordinates: unknown;
}

export interface GisFeature<TProperties = Record<string, unknown>> {
  type: "Feature";
  id: number | string;
  geometry: GisGeometry;
  properties: TProperties;
}

export interface GisFeatureCollection<TProperties = Record<string, unknown>> {
  type: "FeatureCollection";
  features: GisFeature<TProperties>[];
}

export interface RoomProperties {
  id: number;
  room_code: string | null;
  room_name: string | null;
  floor_id: number;
  room_type: string | null;
}

export interface CorridorProperties {
  id: number;
  corridor_name: string | null;
  floor_id: number;
  corridor_type: string | null;
  accessible: boolean;
  status: string | null;
}

export interface NodeProperties {
  id: number;
  node_id: number;
  floor_id: number;
  type: string | null;
}

export interface PoiProperties {
  id: number;
  poi_id: number | null;
  name: string | null;
  category: string | null;
  floor_id: number;
  node_id: number | null;
}

export interface CameraProperties {
  id: number;
  camera_name: string | null;
  floor_id: number;
  status: string | null;
}

export interface CameraCoverageProperties {
  id: number;
  camera_id: number | null;
  floor_id: number;
  monitored_area: string | null;
}

export type CameraDensityLevel = "normal" | "busy" | "congested" | "critical";

export interface CameraStatus {
  camera_id: number;
  camera_name: string | null;
  coverage_id: number | null;
  floor_id: number;
  monitored_area: string | null;
  people_count: number;
  density_level: CameraDensityLevel;
  queue_level: CameraDensityLevel;
  status: "online" | "degraded" | "offline";
  timestamp: string | null;
}

export interface CameraStatusResponse {
  timestamp: string;
  statuses: CameraStatus[];
  count: number;
}

export interface CameraStatusUpdate {
  people_count: number;
  density_level?: CameraDensityLevel;
  queue_level?: CameraDensityLevel;
  status?: "online" | "degraded" | "offline";
}

export interface VerticalTransitionProperties {
  id: number;
  transition_type: string | null;
  floor_from: number;
  floor_to: number;
  accessible: boolean;
  penalty_cost: number;
  transition_name: string | null;
  status: string | null;
}

export interface ImpactedEdgeProperties {
  id: number;
  edge_id: number;
  floor_id: number;
  from_node: number;
  to_node: number;
  type: string | null;
  is_blocked: boolean;
  cost_multiplier: number;
  reason: string | null;
  source: string;
  severity: number;
  updated_at: string | null;
}

export interface RouteEdgeProperties {
  edge_id: number;
  seq: number;
  from_node: number;
  to_node: number;
  floor_id: number | null;
  current_floor_id: number | null;
  next_floor_id: number | null;
  length: number;
  type: string | null;
  cost_multiplier: number;
  override_reason: string | null;
  override_source: string | null;
  override_severity: number | null;
}

interface GisQueryParams {
  floorId?: number;
  srid?: number;
}

const authAxios = axios.create({ withCredentials: true, timeout: 10000 });

function toQueryParams(params: GisQueryParams = {}) {
  return {
    floor_id: params.floorId,
    srid: params.srid,
  };
}

async function getLayer<TProperties>(
  path: string,
  params?: GisQueryParams,
): Promise<GisFeatureCollection<TProperties>> {
  const response = await axios.get<GisFeatureCollection<TProperties>>(`${GIS_BASE}/${path}`, {
    params: toQueryParams(params),
    timeout: 10000,
  });

  return response.data;
}

export const gisApi = {
  getRooms: (params?: GisQueryParams) => getLayer<RoomProperties>("rooms", params),
  getCorridors: (params?: GisQueryParams) => getLayer<CorridorProperties>("corridors", params),
  getNodes: (params?: GisQueryParams) => getLayer<NodeProperties>("nodes", params),
  getPois: (params?: GisQueryParams) => getLayer<PoiProperties>("pois", params),
  getCameras: (params?: GisQueryParams) => getLayer<CameraProperties>("cameras", params),
  getCameraCoverage: (params?: GisQueryParams) =>
    getLayer<CameraCoverageProperties>("camera-coverage", params),
  getCameraStatus: async (params?: GisQueryParams): Promise<CameraStatusResponse> => {
    const response = await axios.get<CameraStatusResponse>(`${GIS_BASE}/camera-status`, {
      params: toQueryParams(params),
      timeout: 10000,
    });

    return response.data;
  },
  updateCameraStatus: async (
    cameraId: number,
    payload: CameraStatusUpdate,
  ): Promise<CameraStatus> => {
    const response = await authAxios.put<CameraStatus>(`${GIS_BASE}/camera-status/${cameraId}`, payload, {
      timeout: 10000,
    });

    return response.data;
  },
  getVerticalTransitions: (params?: GisQueryParams) =>
    getLayer<VerticalTransitionProperties>("vertical-transitions", params),
  getImpactedEdges: (params?: GisQueryParams) =>
    getLayer<ImpactedEdgeProperties>("impacted-edges", params),
};
