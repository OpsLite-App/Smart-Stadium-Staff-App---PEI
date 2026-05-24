'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { api, type GlobalEvacuation } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';

export function GlobalEvacuationNotice() {
  const router = useRouter();
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

  if (!evacuation?.active) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[900] mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white/95 p-3 shadow-2xl shadow-red-950/10 backdrop-blur-md md:bottom-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-red-100 p-2 text-red-700">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-950">Evacuação ativa: {evacuation.title}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              Saída segura: nó {evacuation.exit_node}. Abre o menu de emergência para veres a rota mais rápida.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/app-routes/emergency')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-700"
        >
          Ver evacuação
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
