// lib/stores/useAuthStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api';

type Role = 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';

function toRole(value: string | undefined): Role {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'cleaning') return 'Cleaning';
  if (normalized === 'supervisor') return 'Supervisor';
  if (normalized === 'medical') return 'Medical';
  return 'Security';
}

function permissionsForRole(role: Role) {
  return {
    canViewHeatmap: role === 'Security' || role === 'Supervisor' || role === 'Medical',
    canViewBins: role === 'Cleaning' || role === 'Supervisor',
    canViewAlerts: true,
    canCreateIncidents: role === 'Supervisor',
    canManageIncidents: role === 'Supervisor',
    canDispatchIncidents: role === 'Supervisor',
    canResolveIncidents: role === 'Supervisor' || role === 'Medical',
  };
}

interface User {
  email: string;
  role: Role;
  token?: string;
  id?: number;
  permissions: {
    canViewHeatmap: boolean;
    canViewBins: boolean;
    canViewAlerts: boolean;
    canCreateIncidents: boolean;
    canManageIncidents: boolean;
    canDispatchIncidents: boolean;
    canResolveIncidents: boolean;
  };
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hydrated: boolean;
  error: string | null;

  login: (email: string, password: string, role: Role) => Promise<boolean>;
  logout: () => Promise<void>;
  checkStorage: () => void;
  setHydrated: () => void;
  clearError: () => void;
  syncRoleFromServer: (role: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      hydrated: false,
      error: null,

      clearError: () => set({ error: null }),

      syncRoleFromServer: (role) => {
        const serverRole = toRole(role);
        const currentUser = get().user;
        if (!currentUser || currentUser.role === serverRole) return;

        set({
          user: {
            ...currentUser,
            role: serverRole,
            permissions: permissionsForRole(serverRole),
          },
        });
      },

      setHydrated: () => {
        set({ hydrated: true });
        const state = get();
        console.log('Store hidratado:', state.user ? 'User existe' : 'Sem user');
      },

      login: async (email, password, role) => {
        set({ isLoading: true, error: null });

        try {
          const data = await api.login(email, password, role);
          const serverRole = toRole(data.role);

          const userData = {
            email,
            role: serverRole,
            token: data.token,
            id: data.user_id,
            permissions: permissionsForRole(serverRole),
          };

          set({ user: userData, isLoading: false });

          // Register cleaning staff in Maintenance Service for task assignment
          if (serverRole === 'Cleaning') {
            void api.registerStaffForMaintenance(String(data.user_id), email, serverRole);
          }

          if (serverRole === 'Medical') {
            void api.registerStaffForMaintenance(String(data.user_id), email, serverRole);
          }

          return true;

        } catch (err: unknown) {
          const status =
            typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { status?: number } }).response?.status === 'number'
              ? (err as { response?: { status?: number } }).response?.status
              : undefined;

          if (status === 401) {
            set({
              isLoading: false,
              error: "Email ou password incorretos.",
            });
            return false;
          }

          set({
            isLoading: false,
            error: "Erro de ligação ao servidor.",
          });
          return false;
        }
      },

      logout: async () => {
        console.log('A fazer logout');
        set({ user: null, error: null });
        localStorage.removeItem('auth-storage');
      },

      checkStorage: () => {
        const state = get();
        const storage = localStorage.getItem('auth-storage');
        console.log('Estado atual da store:', state.user ? 'Logado' : 'Não logado');
        console.log('LocalStorage tem dados:', storage ? 'Sim' : 'Não');

        if (storage) {
          try {
            const parsed = JSON.parse(storage);
            console.log('Dados no localStorage:', parsed);

            if (parsed.state?.user?.email) {
              console.log('Email no storage:', parsed.state.user.email);
            } else {
              console.log('Storage corrompido - a limpar...');
              localStorage.removeItem('auth-storage');
            }
          } catch (e) {
            console.error('Erro ao parsear storage:', e);
            localStorage.removeItem('auth-storage');
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        console.log('A hidratar store...');
        if (state) setTimeout(() => state.setHydrated(), 0);
      },
    }
  )
);
