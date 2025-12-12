import { create } from 'zustand';
import React from 'react';
import * as SecureStore from 'expo-secure-store';

// tipos de utilizador 
type Role = 'Security' | 'Cleaning' | 'Supervisor';

interface User {
  email: string;
  role: Role;
  permissions: {
    canViewAllAlerts: boolean;
    canViewHeatmap: boolean;
    canAcceptTasks: boolean;
    canViewAnalytics: boolean;
    canManageStaff: boolean;
    canSeeCleaningAlerts: boolean;
    canSeeSecurityAlerts: boolean;
  };
}

interface AuthState {
  user: { email: string; role: Role } | null;
  isLoading: boolean;
  // As ações que o ecrã pode chamar:
  login: (email: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  // Função que o Ecrã de Login vai chamar
  login: async (email, role) => {
    set({ isLoading: true });

    const permissions = getPermissionsByRole(role);

    // Simulação de API call
    setTimeout(async () => {
      // Guarda o token 
      await SecureStore.setItemAsync('userToken', 'dummy-token-xyz');
  
      // Atualiza o estado global 
      set({ 
        user: { email, role, permissions}, 
        isLoading: false 
      });
      console.log("Login efetuado: ", email);
    }, 1500);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('userToken');
    set({ user: null });
  },
}));

const getPermissionsByRole = (role: Role): User['permissions'] => {
  switch(role) {
    case 'Security':
      return {
        canViewAllAlerts: true,
        canViewHeatmap: true,
        canAcceptTasks: true,
        canViewAnalytics: false,
        canManageStaff: false,
        canSeeCleaningAlerts: false,  
        canSeeSecurityAlerts: true,
      };
    case 'Cleaning':
      return {
        canViewAllAlerts: false,
        canViewHeatmap: false,
        canAcceptTasks: true,
        canViewAnalytics: false,
        canManageStaff: false,
        canSeeCleaningAlerts: true,
        canSeeSecurityAlerts: false,  
      };
    case 'Supervisor':
      return {
        canViewAllAlerts: true,
        canViewHeatmap: true,
        canAcceptTasks: false,  
        canViewAnalytics: true,
        canManageStaff: true,
        canSeeCleaningAlerts: true,
        canSeeSecurityAlerts: true,
      };
  }
};