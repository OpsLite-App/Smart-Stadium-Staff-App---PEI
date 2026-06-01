'use client';

import type { IndoorRouteResponse } from '@/lib/services/indoorRouting';
import { Clock3, MapPinned, Route } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';

interface RouteDetailsCardProps {
  route: IndoorRouteResponse | null;
  routeAffected?: boolean;
  onRecalculate?: () => void;
  recalculating?: boolean;
}

export function RouteDetailsCard({
  route,
  routeAffected = false,
  onRecalculate,
  recalculating = false,
}: RouteDetailsCardProps) {
  if (!route) {
    return (
      <Surface className="border border-dashed border-gray-300 p-5 text-sm text-gray-500" elevation="none">
        Choose a start and destination POI to calculate an indoor route.
      </Surface>
    );
  }

  return (
    <div className="space-y-4">
      {routeAffected && (
        <Surface className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" elevation="none">
          Current route may be affected by live conditions.
        </Surface>
      )}

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Resumo da rota</h3>
            <p className="text-sm text-gray-500">Última rota devolvida pelo backend de cálculo de rotas indoor.</p>
          </div>
          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={recalculating}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {recalculating ? 'A recalcular...' : 'Recalcular rota'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <MapPinned size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Distância</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{route.distance.toFixed(2)} m</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <Clock3 size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">ETA</span>
            </div>
            <p className="text-2xl font-semibold text-gray-900">{route.eta_seconds}s</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-amber-700">
              <Route size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Caminho</span>
            </div>
            <p className="text-sm font-medium text-gray-900 break-words">{route.path.join(' → ')}</p>
          </div>
        </div>
      </Surface>

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Instruções</h3>
          <p className="text-sm text-gray-500">Orientações simples geradas pelo backend de cálculo de rotas.</p>
        </div>

        <ol className="space-y-3">
          {route.instructions.map((instruction, index) => (
            <li key={`${instruction}-${index}`} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-gray-700">{instruction}</p>
            </li>
          ))}
        </ol>
      </Surface>
    </div>
  );
}
