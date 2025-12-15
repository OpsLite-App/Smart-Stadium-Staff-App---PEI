import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
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
  login: (email: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  login: async (email, role) => {
    set({ isLoading: true }); // Liga o spinner

    try {
      const data = await api.login(email, role);

      const token = data.token;
      const userId = data.user_id;

      await SecureStore.setItemAsync('userToken', token);

      const permissions = {
        canViewHeatmap: role === 'Security' || role === 'Supervisor',
        canViewBins: role === 'Cleaning' || role === 'Supervisor',
        canViewAlerts: true
      };

      set({ 
        user: { 
          email: email, 
          role: role as Role, 
          token: token,
          id: userId,
          permissions 
        }, 
        isLoading: false 
      });

      console.log("🔓 Login Store Atualizada com sucesso!");

    } catch (error) {
      console.error("🔒 Erro no Login Store:", error);
      alert("Erro ao entrar. Verifica se o backend está ligado.");
      set({ isLoading: false }); 
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('userToken');
    set({ user: null });
  }
}));