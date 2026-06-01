'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api, type GlobalEvacuation } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';

const EVACUATION_SAFE_STORAGE_KEY = 'opslite-safe-evacuations';

function userSafetyKey(user: { id?: number; email?: string } | null) {
  if (!user) return null;
  if (user.id != null) return `id:${user.id}`;
  if (user.email) return `email:${user.email}`;
  return null;
}

function hasConfirmedLocally(evacuationId: string | undefined, user: { id?: number; email?: string } | null) {
  const key = userSafetyKey(user);
  if (!evacuationId || !key || typeof window === 'undefined') return false;

  try {
    const raw = window.localStorage.getItem(EVACUATION_SAFE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return false;
    const ids = (parsed as Record<string, string[]>)[key] ?? [];
    return ids.includes(evacuationId);
  } catch {
    return false;
  }
}

function hasConfirmedSafety(evacuation: GlobalEvacuation | null, user: { id?: number; email?: string } | null) {
  if (!evacuation?.confirmations || !user) return false;

  return Boolean(
    (user.id != null && evacuation.confirmations[String(user.id)]) ||
      (user.email && evacuation.confirmations[user.email])
  );
}

export function GlobalEvacuationNotice() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [evacuation, setEvacuation] = useState<GlobalEvacuation | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      const active = await api.getActiveGlobalEvacuation().catch(() => ({ active: false }));
      if (!cancelled) setEvacuation(active.active ? active : null);
    }

    void load();
    const interval = window.setInterval(load, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  if (!evacuation?.active || pathname?.startsWith('/app-routes/emergency')) return null;

  const safeConfirmed = hasConfirmedLocally(evacuation.id, user) || hasConfirmedSafety(evacuation, user);
  const noticeStyle = safeConfirmed
    ? 'border-emerald-200 bg-white/95 shadow-emerald-950/10'
    : 'border-red-200 bg-white/95 shadow-red-950/10';
  const iconStyle = safeConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
  const buttonStyle = safeConfirmed
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : 'bg-red-600 hover:bg-red-700';

  return (
    <div className={`fixed inset-x-3 bottom-3 z-[900] mx-auto max-w-3xl rounded-2xl border p-3 shadow-2xl backdrop-blur-md md:bottom-5 ${noticeStyle}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2 ${iconStyle}`}>
            {safeConfirmed ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div>
            <p className="text-sm font-black text-slate-950">
              {safeConfirmed ? 'Segurança confirmada' : `Evacuação ativa: ${evacuation.title}`}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {safeConfirmed
                ? 'A tua confirmação foi registada. Podes consultar o estado da evacuação.'
                : `Saída segura: nó ${evacuation.exit_node}. Abre o menu de emergência para veres a rota mais rápida.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/app-routes/emergency')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white ${buttonStyle}`}
        >
          {safeConfirmed ? 'Ver estado' : 'Ver evacuação'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
