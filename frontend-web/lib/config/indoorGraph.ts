export type FloorId = '1' | '2';

export interface FloorZone {
  id: string;
  floor: FloorId;
  name: string;
  x: number;
  y: number;
  nodeIds: number[];
}

export interface GraphEdgeRef {
  id: number;
  fromNode: number;
  toNode: number;
}

export const FLOOR_ZONES: Record<FloorId, FloorZone[]> = {
  '1': [
    { id: 'f1-a', floor: '1', name: 'Corridor A', x: 20, y: 28, nodeIds: [50, 51, 52] },
    { id: 'f1-b', floor: '1', name: 'Central Hall', x: 48, y: 44, nodeIds: [53, 58, 6] },
    { id: 'f1-c', floor: '1', name: 'Rooms Area', x: 76, y: 26, nodeIds: [1, 2, 3, 9] },
    { id: 'f1-d', floor: '1', name: 'Support Area', x: 70, y: 72, nodeIds: [10, 11, 12, 13] },
  ],
  '2': [
    { id: 'f2-a', floor: '2', name: 'Entrance Area', x: 22, y: 32, nodeIds: [65, 64, 63] },
    { id: 'f2-b', floor: '2', name: 'Main Hall', x: 52, y: 48, nodeIds: [70, 71, 90] },
    { id: 'f2-c', floor: '2', name: 'Teaching Rooms', x: 78, y: 30, nodeIds: [118, 119, 120, 121] },
    { id: 'f2-d', floor: '2', name: 'West Corridor', x: 36, y: 74, nodeIds: [122, 123, 124, 136, 137] },
  ],
};

export const GRAPH_EDGE_REFS: GraphEdgeRef[] = [
  { id: 10, fromNode: 50, toNode: 51 },
  { id: 11, fromNode: 51, toNode: 52 },
  { id: 12, fromNode: 52, toNode: 53 },
  { id: 13, fromNode: 53, toNode: 58 },
  { id: 14, fromNode: 58, toNode: 6 },
  { id: 15, fromNode: 6, toNode: 5 },
  { id: 16, fromNode: 1, toNode: 2 },
  { id: 17, fromNode: 2, toNode: 3 },
  { id: 18, fromNode: 3, toNode: 9 },
  { id: 19, fromNode: 10, toNode: 11 },
  { id: 20, fromNode: 11, toNode: 12 },
  { id: 21, fromNode: 12, toNode: 13 },
  { id: 22, fromNode: 65, toNode: 64 },
  { id: 23, fromNode: 64, toNode: 63 },
  { id: 24, fromNode: 63, toNode: 62 },
  { id: 25, fromNode: 70, toNode: 71 },
  { id: 26, fromNode: 71, toNode: 90 },
  { id: 27, fromNode: 65, toNode: 70 },
  { id: 28, fromNode: 118, toNode: 119 },
  { id: 29, fromNode: 119, toNode: 120 },
  { id: 30, fromNode: 120, toNode: 121 },
  { id: 31, fromNode: 122, toNode: 123 },
  { id: 32, fromNode: 123, toNode: 124 },
  { id: 33, fromNode: 136, toNode: 137 },
];

export function getEdgesForZone(zone: FloorZone, allEdges: GraphEdgeRef[] = GRAPH_EDGE_REFS): GraphEdgeRef[] {
  return allEdges.filter(
    (edge) => zone.nodeIds.includes(edge.fromNode) || zone.nodeIds.includes(edge.toNode)
  );
}
