'use client';

import { AlertTriangle } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import type { OperationalEvent } from '@/lib/services/indoorRouting';

interface AlertsPanelProps {
  events: OperationalEvent[];
  loading?: boolean;
}

const severityStyles = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-blue-200 bg-blue-50 text-blue-700',
};

function getSeverityLabel(severity: number) {
  if (severity >= 0.8) return 'high';
  if (severity >= 0.5) return 'medium';
  return 'low';
}

export function AlertsPanel({ events, loading = false }: AlertsPanelProps) {
  return (
    <Surface className="border border-gray-200 p-5" elevation="sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Alertas operacionais</h3>
          <p className="text-sm text-gray-500">Eventos em tempo real com impacto nas operações indoor.</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Loading active alerts...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          No active alerts
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const severityLabel = getSeverityLabel(event.severity);
            return (
              <div key={event.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {event.event_type}
                      {event.floor_id != null ? ` · Floor ${event.floor_id}` : ''}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${severityStyles[severityLabel]}`}
                  >
                    {severityLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
