'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import {
  AUTH_SERVICE,
  EMERGENCY_SERVICE,
  MAINTENANCE_SERVICE,
  type StaffMember,
} from '@/lib/services/api';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Radio,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  Video,
} from 'lucide-react';

type Severity = 'low' | 'medium' | 'high' | 'critical';
type DispatchStatus = 'dispatched' | 'en_route' | 'arrived' | 'completed' | 'declined' | string;

interface StaffApiEntry extends StaffMember {
  current_location?: string;
}

interface EmergencyIncident {
  id: string;
  incident_type: string;
  location_node: string;
  severity: Severity | string;
  status: string;
  description?: string | null;
  responders_dispatched: number;
  created_at?: string;
  resolved_at?: string | null;
}

interface IncidentDispatch {
  id: string;
  incident_id: string;
  responder_id: string;
  responder_role: string;
  eta_seconds: number;
  status: DispatchStatus;
  dispatched_at: string;
  completed_at?: string | null;
  incident_metadata?: {
    responder_name?: string | null;
    completion_notes?: string | null;
  };
}

interface MaintenanceTask {
  id: string;
  task_type: string;
  status: string;
  priority: string;
  location_node: string;
  assigned_to?: string | null;
  description?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

interface CameraStatus {
  camera_id: number;
  camera_name: string | null;
  floor_id: number;
  monitored_area: string | null;
  people_count: number;
  density_level: 'normal' | 'busy' | 'congested' | 'critical';
  status: string;
  timestamp?: string | null;
}

interface TimelineItem {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  timestamp: string;
  kind: 'incident' | 'dispatch' | 'maintenance' | 'camera';
}

function toSeverity(value: unknown): Severity {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}

function severityColor(severity: Severity): string {
  if (severity === 'critical') return 'bg-red-100 text-red-700 border-red-200';
  if (severity === 'high') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (severity === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
}

function normalizeRole(role: unknown): string {
  const value = String(role ?? '').toLowerCase();
  if (value.includes('security')) return 'Segurança';
  if (value.includes('clean')) return 'Limpeza';
  if (value.includes('supervisor')) return 'Supervisão';
  if (value.includes('medical') || value.includes('medic')) return 'Médico';
  return 'Staff';
}

function normalizeLocation(member: StaffApiEntry): string {
  return String(member.current_location || member.location || 'N/A');
}

function isOpenIncident(incident: EmergencyIncident) {
  const status = String(incident.status || '').toLowerCase();
  return !['resolved', 'false_alarm', 'cancelled'].includes(status);
}

function isActiveDispatch(dispatch: IncidentDispatch) {
  return ['dispatched', 'en_route', 'arrived'].includes(String(dispatch.status || '').toLowerCase());
}

function isOpenTask(task: MaintenanceTask) {
  const status = String(task.status || '').toLowerCase();
  return ['assigned', 'in_progress'].includes(status);
}

function formatEta(seconds: number) {
  if (!seconds || seconds <= 0) return 'ETA N/A';
  return `ETA ${Math.ceil(seconds / 60)} min`;
}

function dispatchTimestamp(dispatch: IncidentDispatch) {
  const value = dispatch.completed_at || dispatch.dispatched_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getLatestDispatchesByResponder(dispatches: IncidentDispatch[]) {
  const latest = new Map<string, IncidentDispatch>();

  dispatches.forEach((dispatch) => {
    const responderId = String(dispatch.responder_id);
    const current = latest.get(responderId);

    if (!current || dispatchTimestamp(dispatch) >= dispatchTimestamp(current)) {
      latest.set(responderId, dispatch);
    }
  });

  return latest;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [staff, setStaff] = useState<StaffApiEntry[]>([]);
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [dispatches, setDispatches] = useState<IncidentDispatch[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [cameraStatuses, setCameraStatuses] = useState<CameraStatus[]>([]);

  const fetchDashboardData = useCallback(async () => {
    const requestConfig = { withCredentials: true, timeout: 6000 };

    try {
      const [staffResult, incidentsResult, assignedTasksResult, inProgressTasksResult, cameraResult] = await Promise.allSettled([
        axios.get<StaffApiEntry[]>(`${AUTH_SERVICE}/staff`, requestConfig),
        axios.get<{ incidents?: EmergencyIncident[] }>(`${EMERGENCY_SERVICE}/incidents`, requestConfig),
        axios.get<{ tasks?: MaintenanceTask[] }>(`${MAINTENANCE_SERVICE}/tasks`, {
          params: { status: 'assigned', limit: 50 },
          ...requestConfig,
        }),
        axios.get<{ tasks?: MaintenanceTask[] }>(`${MAINTENANCE_SERVICE}/tasks`, {
          params: { status: 'in_progress', limit: 50 },
          ...requestConfig,
        }),
        axios.get<{ statuses?: CameraStatus[] }>('/api/gis/camera-status', requestConfig),
      ]);

      const loadedStaff = staffResult.status === 'fulfilled' ? staffResult.value.data || [] : [];
      const loadedIncidents = incidentsResult.status === 'fulfilled' ? incidentsResult.value.data?.incidents || [] : [];
      const loadedTasks = [
        ...(assignedTasksResult.status === 'fulfilled' ? assignedTasksResult.value.data?.tasks || [] : []),
        ...(inProgressTasksResult.status === 'fulfilled' ? inProgressTasksResult.value.data?.tasks || [] : []),
      ];
      const loadedCameras = cameraResult.status === 'fulfilled' ? cameraResult.value.data?.statuses || [] : [];

      const dispatchResults = await Promise.allSettled(
        loadedIncidents.map((incident) =>
          axios.get<IncidentDispatch[]>(`${EMERGENCY_SERVICE}/dispatch/incident/${incident.id}`, requestConfig)
        )
      );

      const loadedDispatches = dispatchResults.flatMap((result) =>
        result.status === 'fulfilled' ? result.value.data || [] : []
      );

      setStaff(loadedStaff);
      setIncidents(loadedIncidents);
      setTasks(loadedTasks);
      setCameraStatuses(loadedCameras);
      setDispatches(loadedDispatches);
      setError('');
      setLastUpdated(new Date());
    } catch {
      setError('Não foi possível carregar os dados reais da dashboard.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function runInitial() {
      setLoading(true);
      await fetchDashboardData();
      if (mounted) setLoading(false);
    }

    void runInitial();

    const interval = setInterval(() => {
      setRefreshing(true);
      void fetchDashboardData().finally(() => setRefreshing(false));
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
    const openIncidents = incidents.filter(isOpenIncident);
    const criticalIncidents = openIncidents.filter((incident) => toSeverity(incident.severity) === 'critical');
    const latestDispatches = Array.from(getLatestDispatchesByResponder(dispatches).values());
    const activeDispatches = latestDispatches.filter(isActiveDispatch);
    const pendingDispatches = latestDispatches.filter((dispatch) => String(dispatch.status).toLowerCase() === 'dispatched');
    const completedDispatches = dispatches.filter((dispatch) => String(dispatch.status).toLowerCase() === 'completed');
    const openTasks = tasks.filter(isOpenTask);
    const criticalCameras = cameraStatuses.filter((camera) => camera.density_level === 'critical');
    const riskyCameras = cameraStatuses.filter((camera) => ['busy', 'congested', 'critical'].includes(camera.density_level));
    const busyStaffIds = new Set(activeDispatches.map((dispatch) => String(dispatch.responder_id)));
    const staffInOperation = staff.filter((member) => busyStaffIds.has(String(member.id))).length;

    const timeline: TimelineItem[] = [
      ...openIncidents.map((incident) => ({
        id: `incident-${incident.id}`,
        title: `${incident.incident_type} em ${incident.location_node}`,
        detail: incident.description || `Estado: ${incident.status}`,
        severity: toSeverity(incident.severity),
        timestamp: incident.created_at || new Date().toISOString(),
        kind: 'incident' as const,
      })),
      ...activeDispatches.map((dispatch) => ({
        id: `dispatch-${dispatch.id}`,
        title: `${dispatch.incident_metadata?.responder_name || `Staff ${dispatch.responder_id}`} em operação`,
        detail: `${dispatch.responder_role} • ${dispatch.status} • ${formatEta(dispatch.eta_seconds)}`,
        severity: String(dispatch.status).toLowerCase() === 'dispatched' ? 'medium' as const : 'low' as const,
        timestamp: dispatch.dispatched_at || new Date().toISOString(),
        kind: 'dispatch' as const,
      })),
      ...openTasks.map((task) => ({
        id: `task-${task.id}`,
        title: task.description || `Tarefa ${task.task_type}`,
        detail: `${task.location_node} • ${task.status}`,
        severity: toSeverity(task.priority),
        timestamp: task.created_at || new Date().toISOString(),
        kind: 'maintenance' as const,
      })),
      ...riskyCameras.map((camera) => ({
        id: `camera-${camera.camera_id}`,
        title: camera.camera_name || `Câmara ${camera.camera_id}`,
        detail: `${camera.monitored_area || `Piso ${camera.floor_id}`} • ${camera.people_count} pessoas • ${camera.density_level}`,
        severity: camera.density_level === 'critical' ? 'critical' as const : camera.density_level === 'congested' ? 'high' as const : 'medium' as const,
        timestamp: camera.timestamp || new Date().toISOString(),
        kind: 'camera' as const,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      openIncidents,
      criticalIncidents,
      activeDispatches,
      pendingDispatches,
      completedDispatches,
      openTasks,
      criticalCameras,
      riskyCameras,
      staffInOperation,
      timeline,
    };
  }, [cameraStatuses, dispatches, incidents, staff, tasks]);

  const teamRows = useMemo(() => {
    const dispatchByResponder = getLatestDispatchesByResponder(dispatches);

    return staff.map((member) => {
      const latestDispatch = dispatchByResponder.get(String(member.id));
      const activeDispatch = latestDispatch && isActiveDispatch(latestDispatch) ? latestDispatch : undefined;

      return {
        ...member,
        location: normalizeLocation(member),
        displayRole: normalizeRole(member.role),
        operationStatus: activeDispatch ? String(activeDispatch.status) : String(member.status || 'available'),
        activeDispatch,
        lastDispatch: latestDispatch,
      };
    });
  }, [dispatches, staff]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Supervisão</p>
          <h1 className="mt-1 text-3xl font-black text-gray-950">Dashboard de Supervisão</h1>
          <p className="mt-1 text-sm text-gray-500">Dados reais dos serviços operacionais, incidentes e GIS.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-PT')}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Staff em operação</span>
            <Users className="text-blue-600" size={20} />
          </div>
          <p className="mt-2 text-3xl font-black text-gray-950">{loading ? '...' : derived.staffInOperation}</p>
          <p className="mt-1 text-xs text-gray-500">Total registado: {staff.length}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Incidentes abertos</span>
            <Shield className="text-red-600" size={20} />
          </div>
          <p className="mt-2 text-3xl font-black text-gray-950">{loading ? '...' : derived.openIncidents.length}</p>
          <p className="mt-1 text-xs text-gray-500">Críticos: {derived.criticalIncidents.length}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Dispatches ativos</span>
            <Radio className="text-orange-600" size={20} />
          </div>
          <p className="mt-2 text-3xl font-black text-gray-950">{loading ? '...' : derived.activeDispatches.length}</p>
          <p className="mt-1 text-xs text-gray-500">Pendentes de aceitar: {derived.pendingDispatches.length}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Operações pendentes</span>
            <Trash2 className="text-emerald-600" size={20} />
          </div>
          <p className="mt-2 text-3xl font-black text-gray-950">{loading ? '...' : derived.openTasks.length + derived.riskyCameras.length}</p>
          <p className="mt-1 text-xs text-gray-500">Tarefas atribuídas: {derived.openTasks.length} • Câmaras risco: {derived.riskyCameras.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <AlertTriangle size={18} className="text-gray-700" />
            <h2 className="text-lg font-bold text-gray-950">Feed operacional</h2>
          </div>
          <div className="space-y-3 p-4">
            {loading ? (
              <p className="text-sm text-gray-500">A carregar dados...</p>
            ) : derived.timeline.length === 0 ? (
              <p className="text-sm text-gray-500">Sem operações ativas neste momento.</p>
            ) : (
              derived.timeline.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${severityColor(item.severity)}`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={12} />
                    {new Date(item.timestamp).toLocaleString('pt-PT')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
            <Video size={18} className="text-gray-700" />
            <h2 className="text-lg font-bold text-gray-950">Estado da equipa</h2>
          </div>
          <div className="space-y-3 p-4">
            {loading ? (
              <p className="text-sm text-gray-500">A carregar equipa...</p>
            ) : teamRows.length === 0 ? (
              <p className="text-sm text-gray-500">Sem staff registado.</p>
            ) : (
              teamRows.map((member) => (
                <div key={member.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{member.name || `Staff ${member.id}`}</p>
                      <p className="text-xs text-gray-500">{member.displayRole} • {member.location}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${member.activeDispatch ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {member.activeDispatch ? member.operationStatus : 'disponível'}
                    </span>
                  </div>
                  {member.activeDispatch && (
                    <p className="mt-1 text-xs text-gray-500">
                      Incidente {member.activeDispatch.incident_id} • {formatEta(member.activeDispatch.eta_seconds)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <h3 className="font-bold text-gray-950">Concluídos</h3>
          </div>
          <p className="mt-2 text-2xl font-black text-gray-950">{derived.completedDispatches.length}</p>
          <p className="text-sm text-gray-500">Dispatches com relatório submetido.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-orange-600" />
            <h3 className="font-bold text-gray-950">Câmaras em risco</h3>
          </div>
          <p className="mt-2 text-2xl font-black text-gray-950">{derived.riskyCameras.length}</p>
          <p className="text-sm text-gray-500">Críticas: {derived.criticalCameras.length}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-slate-600" />
            <h3 className="font-bold text-gray-950">Manutenção</h3>
          </div>
          <p className="mt-2 text-2xl font-black text-gray-950">{derived.openTasks.length}</p>
          <p className="text-sm text-gray-500">Tarefas atribuídas ou em progresso.</p>
        </div>
      </div>
    </div>
  );
}
