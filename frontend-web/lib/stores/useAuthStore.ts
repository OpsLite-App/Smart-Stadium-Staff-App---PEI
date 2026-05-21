// lib/stores/useAuthStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api'; // REMOVED: setAuthToken
import { mergePermissions, normalizeRole, type PermissionSet, type Role } from '@/lib/auth/rbac';

interface User {
  email: string;
  role: Role;
  // REMOVED: token?: string; - Token is now in HttpOnly cookie only
  id?: number;
  permissions: PermissionSet;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hydrated: boolean;
  error: string | null;

  login: (email: string, password: string, role: Role) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreUser: (user: User) => void;
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
        const serverRole = normalizeRole(role);
        const currentUser = get().user;
        if (!currentUser || currentUser.role === serverRole) return;

        set({
          user: {
            ...currentUser,
            role: serverRole,
            permissions: mergePermissions(serverRole),
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
          const serverRole = normalizeRole(data.role);

          // ✅ REMOVED: token from userData (no longer stored)
          const userData = {
            email,
            role: serverRole,
            id: data.user_id,
            permissions: mergePermissions(serverRole, data.permissions),
          };

          // ✅ REMOVED: setAuthToken(data.token); - Token is in cookie, not in JS memory
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
        try {
          await api.logout();
        } catch (error) {
          console.warn('Falha ao limpar sessão no servidor', error);
        } finally {
          // ✅ REMOVED: setAuthToken(''); - No longer needed
          set({ user: null, error: null });
          localStorage.removeItem('auth-storage');
        }
      },

      restoreUser: (user) => {
        set({ user });
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

            // ✅ Check if user exists (token no longer stored)
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
      partialize: (state) => ({
        user: state.user
          ? {
              email: state.user.email,
              role: state.user.role,
              id: state.user.id,
              permissions: state.user.permissions,
              // REMOVED: token - No longer persisted
            }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('A hidratar store...');
        if (state) setTimeout(() => state.setHydrated(), 0);
      },
    }
  )
);
