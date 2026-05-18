'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api } from '@/lib/services/api';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { logout, checkStorage, restoreUser } = useAuthStore();

  const restoreSession = useCallback(async () => {
    const currentUser = useAuthStore.getState().user;
    // ✅ REMOVED: currentUser?.token check (token no longer stored)
    // Session is restored via cookie, not token in store
    
    // If we're already on an auth route (login/register), skip automatic /me checks
    if (typeof window !== 'undefined') {
      const p = window.location.pathname || '';
      if (p.startsWith('/auth-routes')) return;
    }

    console.log('Restaurando sessão a partir do cookie de autenticação');

    try {
      const data = await api.me();
      const serverRole = toRole(data.role);
      
      // ✅ CORRIGIDO: Use email from data or fallback
      // ✅ REMOVED: token from restoreUser (no longer stored)
      restoreUser({
        email: data.email ?? data.username ?? currentUser?.email ?? '',
        role: serverRole,
        id: data.user_id,
        permissions: permissionsForRole(serverRole),
      });
      console.log('Sessão restaurada com sucesso');
    } catch (error) {
      console.warn('Não foi possível restaurar a sessão:', error);
      // If we're already on an auth route, don't force a redirect (avoids reload loop)
      if (typeof window !== 'undefined') {
        const p = window.location.pathname || '';
        if (p.startsWith('/auth-routes')) return;
      }

      await logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth-routes/login';
      }
    }
  }, [logout, restoreUser]);

  useEffect(() => {
    checkStorage();
    void restoreSession();

    const intervalId = setInterval(restoreSession, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [checkStorage, restoreSession]);

  return <>{children}</>;
}