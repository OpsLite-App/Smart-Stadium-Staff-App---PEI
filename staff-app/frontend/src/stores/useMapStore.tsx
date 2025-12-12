import { create } from 'zustand';
import React from 'react';
export interface StaffMember {
  id: string;
  name: string;
  role: 'Security' | 'Cleaning' | 'Supervisor';
  lat: number;
  lng: number;
}

// Tipo para coordenadas simples
interface LatLng {
  latitude: number;
  longitude: number;
}

interface MapState {
  staff: StaffMember[];
  activeRoute: LatLng[] | null; // <--- NOVA: A rota atual para desenhar
  
  updatePositions: () => void;
  requestRoute: (toLocation: LatLng) => void; // <--- NOVA: Ação de pedir rota
  clearRoute: () => void;
}

// stores/useMapStore.ts
const INITIAL_STAFF: StaffMember[] = [
  { id: '1', name: 'João Silva', role: 'Security', lat: 41.1625, lng: -8.5830 }, 
  { id: '2', name: 'Maria Santos', role: 'Cleaning', lat: 41.1610, lng: -8.5845 }, 
  { id: '3', name: 'Carlos Chefe', role: 'Supervisor', lat: 41.1618, lng: -8.5835 }, 
  { id: '4', name: 'Pedro Security', role: 'Security', lat: 41.1630, lng: -8.5825 }, 
  { id: '5', name: 'Ana Cleaning', role: 'Cleaning', lat: 41.1608, lng: -8.5840 }, 
  { id: '6', name: 'Miguel Supervisor', role: 'Supervisor', lat: 41.1620, lng: -8.5832 }, 
];

export const useMapStore = create<MapState>((set) => ({
  staff: INITIAL_STAFF,
  activeRoute: null, // Começa sem rota

  updatePositions: () => {
    set((state) => ({
      staff: state.staff.map((member) => ({
        ...member,
        lat: member.lat + (Math.random() - 0.5) * 0.0001,
        lng: member.lng + (Math.random() - 0.5) * 0.0001,
      })),
    }));
  },

  // Simula um cálculo de rota (Mock)
  requestRoute: (toLocation) => {
    // Na vida real, chamarias uma API aqui.
    // Para a demo, criamos um caminho fixo do "Staff 1" até ao "Incidente".
    const mockRoute = [
      { latitude: 41.1618, longitude: -8.5835 }, // Ponto A (Segurança)
      { latitude: 41.1619, longitude: -8.5836 },
      { latitude: 41.1621, longitude: -8.5837 },
      { latitude: toLocation.latitude, longitude: toLocation.longitude }, // Ponto B (Incidente)
    ];
    
    console.log("Rota calculada!");
    set({ activeRoute: mockRoute });
  },

  clearRoute: () => set({ activeRoute: null }),
}));