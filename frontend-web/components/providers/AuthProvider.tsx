'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api } from '@/lib/services/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, logout, checkStorage } = useAuthStore();

  const validateToken = useCallback(async () => {
    const currentUser = useAuthStore.getState().user;
    
    if (!currentUser?.token) {
      console.log('Nenhum token encontrado');
      return;
    }

    console.log('A validar token para utilizador:', currentUser.email);
    
    try {
      const isValid = await api.validateToken(currentUser.token);
      
      if (isValid) {
        console.log('Token válido - sessão mantida');
        
      } else {
        console.log('Token inválido - a fazer logout');
        await logout();
        
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('Erro na validação do token:', error);
    }
  }, [logout]);

  useEffect(() => {
    checkStorage();
    
    validateToken();
    
    const intervalId = setInterval(validateToken, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
    
  }, [validateToken, checkStorage]);

  return <>{children}</>;
}