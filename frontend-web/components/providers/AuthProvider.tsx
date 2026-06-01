'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api } from '@/lib/services/api';
import { mergePermissions, normalizeRole } from '@/lib/auth/rbac';

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

    console.debug('[Auth Provider] Restoring session from authentication cookie');

    try {
      const data = await api.me();
      const serverRole = normalizeRole(data.role);
      
      // ✅ CORRIGIDO: Use email from data or fallback
      // ✅ REMOVED: token from restoreUser (no longer stored)
      restoreUser({
        email: data.email ?? data.username ?? currentUser?.email ?? '',
        role: serverRole,
        id: data.user_id,
        permissions: mergePermissions(serverRole, data.permissions),
      });
      console.debug('[Auth Provider] Session restored');
    } catch (error) {
      console.warn('[Auth Provider] Session restoration failed:', error);
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
