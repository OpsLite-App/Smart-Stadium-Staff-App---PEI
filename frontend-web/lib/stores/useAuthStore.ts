// lib/stores/useAuthStore.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api';

type Role = 'Security' | 'Cleaning' | 'Supervisor';

interface User {
  email: string;
  role: Role;
  token?: string;
  id?: number;
  permissions: {
    canViewHeatmap: boolean;
    canViewBins: boolean;
    canViewAlerts: boolean;
  };
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  hydrated: boolean;
  login: (email: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  checkStorage: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      hydrated: false,

      setHydrated: () => {
        set({ hydrated: true });
        // Verifica o estado depois de hidratar
        const state = get();
        console.log('Store hidratado:', state.user ? 'User existe' : 'Sem user');
      },

      login: async (email, role) => {
        set({ isLoading: true });

        try {
          console.log('A fazer login com:', { email, role });
          const data = await api.login(email, role);
          console.log('Resposta do login:', data);
          
          const token = data.token;
          const userId = data.user_id;
          
          const permissions = {
            canViewHeatmap: role === 'Security' || role === 'Supervisor',
            canViewBins: role === 'Cleaning' || role === 'Supervisor',
            canViewAlerts: true
          };

          const userData = { 
            email, 
            role, 
            token,
            id: userId,
            permissions 
          };

          console.log('A guardar user:', userData);
          
          set({ 
            user: userData, 
            isLoading: false 
          });

          // Verifica se guardou corretamente
          setTimeout(() => {
            const state = get();
            console.log('User após set:', state.user);
          }, 100);

        } catch (error) {
          console.error("Erro no Login Store:", error);
          alert("Erro ao entrar. Verifica se o backend está ligado.");
          set({ isLoading: false });
        }
      },

      logout: async () => {
        console.log('A fazer logout');
        set({ user: null });
        // Limpa completamente o localStorage
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
            
            // Verifica se os dados são válidos
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
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        console.log('A hidratar store...');
        if (state) {
          // Pequeno atraso para garantir que a hidratação está completa
          setTimeout(() => {
            state.setHydrated();
          }, 0);
        }
      },
    }
  )
);