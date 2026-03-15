'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import {
  AUTH_SERVICE,
  CONGESTION_SERVICE,
  EMERGENCY_SERVICE,
  MAINTENANCE_SERVICE,
  QUEUEING_SERVICE,
  type StaffMember,
  type HeatmapPoint,
} from '@/lib/services/api';
import {
  AlertTriangle,
  Clock,
  Flame,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  Waves,
} from 'lucide-react';

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface EmergencyIncident {
  id: string;
  incident_type: string;
  location_node: string;
  severity: Severity;
  status: string;
  created_at?: string;
}

interface BinAlert {
  id: string;
  location_node: string;
  fill_percentage: number;
  priority: string;
  status: string;
  created_at?: string;
}

interface QueueAlert {
  location_id: string;
  wait_time_minutes: number;
  status: string;
}

interface CongestionAlert {
  area_id: string;
  occupancy_rate: number;
  severity?: Severity;
}

interface TimelineItem {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  timestamp: string;
}

function getStoredToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.token ?? '';
  } catch {
    return '';
  }
}

function severityColor(severity: Severity): string {
  if (severity === 'critical') return 'bg-red-100 text-red-700 border-red-200';
  if (severity === 'high') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (severity === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
}

function toSeverity(value: string | undefined | null): Severity {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}

function normalizeRole(role: string | undefined | null): string {
  const value = String(role ?? '').toLowerCase();
  if (value.includes('security')) return 'Segurança';
  if (value.includes('clean')) return 'Limpeza';
  if (value.includes('supervisor')) return 'Supervisão';
  if (value.includes('medical')) return 'Médica';
  if (value.includes('maintenance')) return 'Manutenção';
  return 'Staff';
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [binAlerts, setBinAlerts] = useState<BinAlert[]>([]);
  const [queueAlerts, setQueueAlerts] = useState<QueueAlert[]>([]);
  const [congestionAlerts, setCongestionAlerts] = useState<CongestionAlert[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);

  const fetchDashboardData = useCallback(async () => {
    const token = user?.token || getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const requests = await Promise.allSettled([
      axios.get<StaffMember[]>(`${AUTH_SERVICE}/staff`, { headers, timeout: 6000 }),
      axios.get<{ incidents?: EmergencyIncident[] }>(`${EMERGENCY_SERVICE}/incidents`, { headers, timeout: 6000 }),
      axios.get<BinAlert[]>(`${MAINTENANCE_SERVICE}/bins/alerts`, { headers, timeout: 6000 }),
      axios.get<{ alerts?: QueueAlert[] }>(`${QUEUEING_SERVICE}/alerts`, {
        params: { threshold_minutes: 8 },
        headers,
        timeout: 6000,
      }),
      axios.get<{ alerts?: CongestionAlert[] }>(`${CONGESTION_SERVICE}/alerts`, {
        params: { threshold: 80 },
        headers,
        timeout: 6000,
      }),
      axios.get<{ points?: HeatmapPoint[] }>(`${CONGESTION_SERVICE}/heatmap/points`, { headers, timeout: 6000 }),
    ]);

    const [staffRes, incidentsRes, binsRes, queueRes, congestionRes, heatRes] = requests;

    if (staffRes.status === 'fulfilled') setStaff(staffRes.value.data || []);
    if (incidentsRes.status === 'fulfilled') setIncidents(incidentsRes.value.data?.incidents || []);
    if (binsRes.status === 'fulfilled') setBinAlerts(binsRes.value.data || []);
    if (queueRes.status === 'fulfilled') setQueueAlerts(queueRes.value.data?.alerts || []);
    if (congestionRes.status === 'fulfilled') setCongestionAlerts(congestionRes.value.data?.alerts || []);
    if (heatRes.status === 'fulfilled') setHeatmapPoints(heatRes.value.data?.points || []);

    const allFailed = requests.every((r) => r.status === 'rejected');
    setError(allFailed ? 'Não foi possível carregar dados dos serviços.' : '');
    setLastUpdated(new Date().toISOString());
  }, [user?.token]);

  useEffect(() => {
    let mounted = true;

    const runInitial = async () => {
      setLoading(true);
      await fetchDashboardData();
      if (mounted) setLoading(false);
    };

    void runInitial();

    const interval = setInterval(() => {
      void fetchDashboardData();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const derived = useMemo(() => {
    const activeStaff = staff.filter((s) => {
      const status = String(s.status || '').toLowerCase();
      return ['active', 'online', 'available', 'patrol', 'responding'].includes(status);
    }).length;

    const openIncidents = incidents.filter((i) => {
      const status = String(i.status || '').toLowerCase();
      return status !== 'resolved' && status !== 'false_alarm';
    });

    const criticalIncidents = openIncidents.filter((i) => toSeverity(i.severity) === 'critical').length;

    const openBinAlerts = binAlerts.filter((b) => {
      const status = String(b.status || '').toLowerCase();
      return status !== 'completed' && status !== 'resolved';
    });

    const heatRiskAreas = heatmapPoints.filter((p) => {
      const occupancy = Number(p.occupancy_rate ?? p.weight * 100 ?? 0);
      return occupancy >= 80;
    }).length;

    const timeline: TimelineItem[] = [
      ...openIncidents.slice(0, 6).map((i) => ({
        id: `incident-${i.id}`,
        title: `Incidente ${i.incident_type}`,
        detail: `Local: ${i.location_node}`,
        severity: toSeverity(i.severity),
        timestamp: i.created_at || new Date().toISOString(),
      })),
      ...congestionAlerts.slice(0, 6).map((a, idx) => ({
        id: `congestion-${a.area_id}-${idx}`,
        title: 'Congestionamento elevado',
        detail: `${a.area_id} com ${Math.round(a.occupancy_rate)}%`,
        severity: toSeverity(a.severity || (a.occupancy_rate >= 95 ? 'critical' : 'high')),
        timestamp: new Date().toISOString(),
      })),
      ...openBinAlerts.slice(0, 6).map((b) => ({
        id: `bin-${b.id}`,
        title: 'Lixeira por recolher',
        detail: `${b.location_node} (${Math.round(b.fill_percentage)}%)`,
        severity: toSeverity(b.priority),
        timestamp: b.created_at || new Date().toISOString(),
      })),
      ...queueAlerts.slice(0, 6).map((q, idx) => ({
        id: `queue-${q.location_id}-${idx}`,
        title: 'Fila longa',
        detail: `${q.location_id} (${q.wait_time_minutes.toFixed(1)} min)`,
        severity: toSeverity(q.status),
        timestamp: new Date().toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);

    return {
      activeStaff,
      openIncidents: openIncidents.length,
      criticalIncidents,
      openBinAlerts: openBinAlerts.length,
      queueAlerts: queueAlerts.length,
      congestionAlerts: congestionAlerts.length,
      heatRiskAreas,
      timeline,
    };
  }, [staff, incidents, binAlerts, heatmapPoints, congestionAlerts, queueAlerts]);

  const roleTitle = useMemo(() => {
    const role = normalizeRole(user?.role);
    if (role === 'Segurança') return 'Dashboard de Segurança';
    if (role === 'Limpeza') return 'Dashboard de Limpeza';
    if (role === 'Supervisão') return 'Dashboard de Supervisão';
    return 'Dashboard Operacional';
  }, [user?.role]);

  const formattedUpdated = useMemo(() => {
    if (!lastUpdated) return 'sem atualização';
    return new Date(lastUpdated).toLocaleString('pt-PT');
  }, [lastUpdated]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{roleTitle}</h1>
            <p className="text-sm text-gray-500 mt-1">Dados reais dos serviços em tempo quase real</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Atualizado: {formattedUpdated}</span>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Staff ativo</span>
              <Users className="text-blue-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : derived.activeStaff}</p>
            <p className="text-xs text-gray-500 mt-1">Total registado: {staff.length}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Incidentes abertos</span>
              <Shield className="text-red-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : derived.openIncidents}</p>
            <p className="text-xs text-gray-500 mt-1">Críticos: {derived.criticalIncidents}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Congestionamento</span>
              <Flame className="text-orange-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : derived.congestionAlerts}</p>
            <p className="text-xs text-gray-500 mt-1">Zonas risco (heatmap): {derived.heatRiskAreas}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Operações pendentes</span>
              <Trash2 className="text-emerald-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{loading ? '...' : derived.openBinAlerts + derived.queueAlerts}</p>
            <p className="text-xs text-gray-500 mt-1">Lixeiras: {derived.openBinAlerts} • Filas: {derived.queueAlerts}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Feed operacional</h2>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                <p className="text-sm text-gray-500">A carregar eventos...</p>
              ) : derived.timeline.length === 0 ? (
                <p className="text-sm text-gray-500">Sem eventos ativos neste momento.</p>
              ) : (
                derived.timeline.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${severityColor(item.severity)}`}>
                        {item.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.detail}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      {new Date(item.timestamp).toLocaleString('pt-PT')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
              <Waves size={18} className="text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Estado da equipa</h2>
            </div>
            <div className="p-4 space-y-3">
              {loading ? (
                <p className="text-sm text-gray-500">A carregar equipa...</p>
              ) : staff.length === 0 ? (
                <p className="text-sm text-gray-500">Sem staff disponível.</p>
              ) : (
                staff.slice(0, 8).map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{member.name || `Staff ${member.id}`}</p>
                      <p className="text-xs text-gray-500">{normalizeRole(member.role)} • {member.location || 'N/A'}</p>
                    </div>
                    <span className="text-xs text-gray-600">{member.status || 'unknown'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
