// lib/stores/useNavigationStore.ts
import { create } from 'zustand';

export interface RouteWaypoint {
  node_id: string;
  x: number;
  y: number;
}

export interface ActiveNavigation {
  taskId: string;
  binId: string;
  binName: string;
  targetNode: string;
  fromNode: string;
  waypoints: RouteWaypoint[];
  etaSeconds: number;
}

interface NavigationState {
  active: ActiveNavigation | null;
  currentNode: string;
  setNavigation: (nav: ActiveNavigation) => void;
  clearNavigation: () => void;
  setCurrentNode: (node: string) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  active: null,
  currentNode: 'N1',
  setNavigation: (nav) => set({ active: nav, currentNode: nav.fromNode }),
  clearNavigation: () => set({ active: null }),
  setCurrentNode: (node) => set({ currentNode: node }),
}));
