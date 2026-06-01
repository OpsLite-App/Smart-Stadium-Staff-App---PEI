// lib/stores/useNavigationStore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      active: null,
      currentNode: '62',
      setNavigation: (nav) => set({ active: nav, currentNode: nav.fromNode }),
      clearNavigation: () => set({ active: null }),
      setCurrentNode: (node) => set({ currentNode: node }),
    }),
    {
      name: 'navigation-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        active: state.active,
        currentNode: state.currentNode,
      }),
    }
  )
);
