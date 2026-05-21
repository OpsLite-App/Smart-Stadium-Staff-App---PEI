'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { RouteWaypoint, useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api, EMERGENCY_SERVICE } from '@/lib/services/api';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import { indoorRoutingService, type IndoorRouteGeoJsonResponse } from '@/lib/services/indoorRouting';
import axios from 'axios';
import { Ban, CheckCircle, Clock, MapPin, RefreshCw, AlertTriangle, X, ThumbsUp, ClipboardList } from 'lucide-react';

interface MaintenanceTask {
  id: string;
  task_type: string;
  location_node: string;
  priority: string;
  status: string;
  description?: string;
  assigned_to?: string;
  main_metadata?: { bin_id?: string; fill_percentage?: number };
  created_at?: string;
}

interface IncidentDispatch {
  id: string;
  incident_id: string;
  responder_id: string;
  responder_role: string;
  route_nodes: string[];
  route_distance: number;
  eta_seconds: number;
  status: string;
  dispatched_at: string;
  incident_type?: string;
  incident_location?: string;
  incident_severity?: string;
  incident_description?: string | null;
}

interface IncidentSummary {
  id: string;
  incident_type?: string;
  location_node?: string;
  severity?: string;
  description?: string | null;
  location_description?: string | null;
}

type TaskLocalStatus = 'pending' | 'accepted' | 'refused' | 'done';
type CompletionTarget = {
  kind: 'dispatch' | 'task';
  id: string;
  title: string;
} | null;

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

function getDefaultStartNode(role?: string) {
  const normalizedRole = String(role ?? '').toLowerCase();
  if (normalizedRole.includes('clean')) return '70';
  if (normalizedRole.includes('medic')) return '1';
  if (normalizedRole.includes('security')) return '66';
  return '62';
}

function isAcceptedStatus(status?: string) {
  return ['in_progress', 'en_route', 'arrived'].includes(String(status ?? '').toLowerCase());
}

function isFalseAlarmStatus(status?: string) {
  return String(status ?? '').toLowerCase() === 'false_alarm';
}

function getDispatchTarget(dispatch: IncidentDispatch) {
  if (dispatch.incident_location && dispatch.incident_location !== '?') return dispatch.incident_location;
  return dispatch.route_nodes.at(-1) ?? '62';
}

export default function TasksPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { setNavigation } = useNavigationStore();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [dispatches, setDispatches] = useState<IncidentDispatch[]>([]);
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskLocalStatus>>({});
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, TaskLocalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<CompletionTarget>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [routeModal, setRouteModal] = useState<{ title: string; fromNode: string; toNode: string } | null>(null);
  const [routeModalGeoJson, setRouteModalGeoJson] = useState<IndoorRouteGeoJsonResponse | null>(null);
  const [routeModalFloor, setRouteModalFloor] = useState<'0' | '1' | '2'>('1');
  const [routeModalLoading, setRouteModalLoading] = useState(false);
  const [routeModalError, setRouteModalError] = useState<string | null>(null);

  // Ocupado se tiver pelo menos uma tarefa/dispatch aceite
  const isBusy = Object.values(taskStatus).some(s => s === 'accepted') ||
                 Object.values(dispatchStatus).some(s => s === 'accepted') ||
                 tasks.some((task) => isAcceptedStatus(task.status)) ||
                 dispatches.some((dispatch) => isAcceptedStatus(dispatch.status));

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const myId = String(user.id);
      const [tasksData, allDispatches, allIncidents] = await Promise.all([
        api.getMyTasks(myId),
        axios.get(`${EMERGENCY_SERVICE}/dispatch/active`, { timeout: 6000 })
          .then(r => r.data as IncidentDispatch[]).catch(() => [] as IncidentDispatch[]),
        axios.get(`${EMERGENCY_SERVICE}/incidents`, { timeout: 6000 })
          .then(r => (r.data.incidents ?? r.data) as IncidentSummary[]).catch(() => [] as IncidentSummary[]),
      ]);

      setTasks(tasksData);

      const myDispatches = (allDispatches).filter(
        d => d.responder_id === myId ||
             d.responder_id === `STAFF_${user.role?.toUpperCase()}_${myId.padStart(3, '0')}`
      );

      const enriched = myDispatches.map(d => {
        const inc = allIncidents.find(i => i.id === d.incident_id);
        return {
          ...d,
          incident_type: inc?.incident_type ?? 'incident',
          incident_location: inc?.location_node ?? '?',
          incident_severity: inc?.severity ?? 'medium',
          incident_description: inc?.description ?? inc?.location_description ?? null,
        };
      });

      setDispatches(enriched);
      setLastUpdated(new Date());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => { setRefreshing(true); void fetchTasks(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // --- Task actions ---
  const handleAcceptTask = async (taskId: string) => {
    setActionLoading(`accept-${taskId}`);
    try {
      await api.startTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'accepted' }));
      await fetchTasks();
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefuseTask = async (taskId: string) => {
    setActionLoading(`refuse-${taskId}`);
    try {
      await api.refuseTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'refused' }));
      await fetchTasks();
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleNavigateTask = async (task: MaintenanceTask) => {
    setActionLoading(`nav-${task.id}`);
    const fromNode = getDefaultStartNode(user?.role);
    const targetNode = task.location_node;
    setRouteModal({
      title: task.description ?? `Tarefa em ${targetNode}`,
      fromNode,
      toNode: targetNode,
    });
    setRouteModalGeoJson(null);
    setRouteModalError(null);
    setRouteModalLoading(true);

    try {
      const [route, geoJsonRoute] = await Promise.all([
        api.getRoute(fromNode, targetNode),
        indoorRoutingService.getRouteGeoJson(Number(fromNode), Number(targetNode)),
      ]);
      if (task.status !== 'in_progress') {
        await api.startTask(task.id).catch(() => null);
      }
      setTaskStatus(prev => ({ ...prev, [task.id]: 'accepted' }));
      setNavigation({
        taskId: task.id,
        binId: task.main_metadata?.bin_id ?? task.id,
        binName: task.description ?? `Lixeira ${targetNode}`,
        targetNode,
        fromNode,
        waypoints: route.waypoints,
        etaSeconds: route.eta_seconds,
      });
      setRouteModalGeoJson(geoJsonRoute);
      const firstFloor = geoJsonRoute.summary.floors[0];
      if (firstFloor != null) {
        setRouteModalFloor(String(firstFloor) as '0' | '1' | '2');
      }
    } catch {
      setRouteModalError(t('common.route_error'));
    } finally {
      setActionLoading(null);
      setRouteModalLoading(false);
    }
  };

  const handleDoneTask = async (taskId: string) => {
    setActionLoading(`done-${taskId}`);
    try {
      await api.completeTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'done' }));
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  // --- Dispatch actions ---
  const handleAcceptDispatch = async (dispatchId: string) => {
    setActionLoading(`accept-dispatch-${dispatchId}`);
    try {
      await api.acceptDispatch(dispatchId);
      setDispatchStatus(prev => ({ ...prev, [dispatchId]: 'accepted' }));
      await fetchTasks();
    } catch {
      alert('Não foi possível aceitar este incidente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefuseDispatch = async (dispatchId: string) => {
    setActionLoading(`refuse-dispatch-${dispatchId}`);
    try {
      await api.refuseDispatch(dispatchId);
      setDispatchStatus(prev => ({ ...prev, [dispatchId]: 'refused' }));
      await fetchTasks();
    } catch {
      alert('Não foi possível recusar este incidente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNavigateDispatch = async (d: IncidentDispatch) => {
    if (isFalseAlarmStatus(d.status)) return;

    setActionLoading(`nav-dispatch-${d.id}`);
    const fromNode = d.route_nodes[0] ?? getDefaultStartNode(user?.role);
    const targetNode = getDispatchTarget(d);
    setRouteModal({
      title: `${d.incident_type?.toUpperCase() ?? 'INCIDENTE'} em ${targetNode}`,
      fromNode,
      toNode: targetNode,
    });
    setRouteModalGeoJson(null);
    setRouteModalError(null);
    setRouteModalLoading(true);

    try {
      if (!isAcceptedStatus(d.status) && dispatchStatus[d.id] !== 'accepted') {
        await api.acceptDispatch(d.id).catch(() => null);
      }
      const [route, geoJsonRoute] = await Promise.all([
        api.getRoute(fromNode, targetNode),
        indoorRoutingService.getRouteGeoJson(Number(fromNode), Number(targetNode)),
      ]);
      const waypoints: RouteWaypoint[] = route.waypoints;
      setDispatchStatus(prev => ({ ...prev, [d.id]: 'accepted' }));
      setNavigation({
        taskId: d.id,
        binId: d.incident_id,
        binName: `${d.incident_type?.toUpperCase()} — ${targetNode}`,
        targetNode,
        fromNode,
        waypoints,
        etaSeconds: route.eta_seconds || d.eta_seconds,
      });
      setRouteModalGeoJson(geoJsonRoute);
      const firstFloor = geoJsonRoute.summary.floors[0];
      if (firstFloor != null) {
        setRouteModalFloor(String(firstFloor) as '0' | '1' | '2');
      }
    } catch {
      setRouteModalError(t('common.route_error'));
    } finally {
      setActionLoading(null);
      setRouteModalLoading(false);
    }
  };

  const openCompletionDialog = (target: Exclude<CompletionTarget, null>) => {
    setCompletionTarget(target);
    setCompletionNotes('');
  };

  const closeCompletionDialog = () => {
    if (actionLoading?.startsWith('complete-')) return;
    setCompletionTarget(null);
    setCompletionNotes('');
  };

  const handleConfirmCompletion = async () => {
    if (!completionTarget || completionNotes.trim().length < 3) return;

    setActionLoading(`complete-${completionTarget.kind}-${completionTarget.id}`);
    try {
      if (completionTarget.kind === 'task') {
        await api.completeTask(completionTarget.id, completionNotes.trim());
        setTaskStatus(prev => ({ ...prev, [completionTarget.id]: 'done' }));
      } else {
        await api.completeDispatch(completionTarget.id, completionNotes.trim());
        setDispatchStatus(prev => ({ ...prev, [completionTarget.id]: 'done' }));
      }

      setCompletionTarget(null);
      setCompletionNotes('');
      await fetchTasks();
    } catch {
      alert('Não foi possível concluir esta tarefa.');
    } finally {
      setActionLoading(null);
    }
  };

  const activeTasks = tasks.filter(t => taskStatus[t.id] !== 'refused' && taskStatus[t.id] !== 'done');
  const activeDispatches = dispatches.filter(d => !['refused', 'done'].includes(dispatchStatus[d.id] ?? ''));
  const totalCount = activeTasks.length + activeDispatches.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Operações atribuídas</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{t('tasks.title')}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm text-gray-500">
                {t(totalCount === 1 ? 'tasks.active_count_one' : 'tasks.active_count_other', { count: totalCount })}
              </p>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                isBusy ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isBusy ? 'bg-orange-500' : 'bg-green-500'}`} />
                {isBusy ? t('common.busy') : t('common.available')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-400">{t('common.updated_at')} {lastUpdated.toLocaleTimeString()}</span>
            )}
            <button
              onClick={() => { setRefreshing(true); void fetchTasks(); }}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Incidentes</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{activeDispatches.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Manutenção</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{activeTasks.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-1 text-lg font-black text-slate-950">{isBusy ? 'Em operação' : 'Disponível'}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">{t('tasks.loading')}</div>
      ) : totalCount === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-medium text-gray-700">{t('tasks.empty_title')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('tasks.empty_subtitle')}</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          {activeDispatches.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-500">
                <AlertTriangle size={14} /> {t('tasks.section_incidents')}
              </p>
              {activeDispatches.map(d => {
                const isFalseAlarm = isFalseAlarmStatus(d.status);
                const status = isFalseAlarm
                  ? 'false_alarm'
                  : dispatchStatus[d.id] ?? (isAcceptedStatus(d.status) ? 'accepted' : 'pending');
                const targetNode = getDispatchTarget(d);
                return (
                  <div
                    key={d.id}
                    className={`rounded-3xl border p-5 shadow-sm ${
                      isFalseAlarm
                        ? 'border-slate-300 bg-[linear-gradient(180deg,#f8fafc,#fff)]'
                        : 'border-red-200 bg-[linear-gradient(180deg,#fff7f7,#fff)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {isFalseAlarm ? (
                          <Ban size={18} className="shrink-0 text-slate-500" />
                        ) : (
                          <AlertTriangle size={18} className="text-red-500 shrink-0" />
                        )}
                        <div>
                          <p className="font-bold text-gray-900 capitalize">{d.incident_type?.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-500">{t('tasks.location')}: <span className="font-medium">{targetNode}</span></p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-700">
                            {isFalseAlarm
                              ? 'O supervisor cancelou este incidente como falso alarme. Não é necessária intervenção.'
                              : d.incident_description || 'Sem descrição adicional do incidente.'}
                          </p>
                          {!isFalseAlarm && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                              <Clock size={12} /> ETA previsto: {Math.ceil((d.eta_seconds || 0) / 60)} min
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        isFalseAlarm ? 'border-slate-200 bg-slate-100 text-slate-700' : SEVERITY_STYLE[d.incident_severity ?? 'medium'] ?? SEVERITY_STYLE.medium
                      }`}>
                        {isFalseAlarm ? 'falso alarme' : d.incident_severity}
                      </span>
                    </div>
                    {status === 'false_alarm' ? (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setDispatchStatus(prev => ({ ...prev, [d.id]: 'done' }))}
                          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <CheckCircle size={16} /> Tomei conhecimento
                        </button>
                      </div>
                    ) : status === 'accepted' ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleNavigateDispatch(d)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                          <MapPin size={16} /> {t('common.navigate')}
                        </button>
                        <button
                          onClick={() => openCompletionDialog({
                            kind: 'dispatch',
                            id: d.id,
                            title: `${d.incident_type ?? 'Incidente'} em ${targetNode}`,
                          })}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle size={16} /> Concluir tarefa
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptDispatch(d.id)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                          <ThumbsUp size={16} /> {t('common.accept')}
                        </button>
                        <button onClick={() => handleNavigateDispatch(d)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                          <MapPin size={16} /> {t('common.navigate')}
                        </button>
                        <button onClick={() => handleRefuseDispatch(d.id)} disabled={!!actionLoading} className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                          <X size={16} /> {t('common.refuse')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTasks.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500">
                <ClipboardList size={14} /> {t('tasks.section_maintenance')}
              </p>
              {activeTasks.map(task => {
                const status = taskStatus[task.id] ?? (isAcceptedStatus(task.status) ? 'accepted' : 'pending');
                return (
                  <div key={task.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {task.description ?? `Lixeira ${task.main_metadata?.bin_id ?? task.location_node}`}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-700">
                          {task.description || 'Sem descrição adicional da tarefa.'}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {t('tasks.location')}: {task.location_node}
                          {task.main_metadata?.fill_percentage != null && (
                            <span className="ml-2 font-medium text-orange-600">{task.main_metadata.fill_percentage}% {t('tasks.fill')}</span>
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.low}`}>
                        {task.priority}
                      </span>
                    </div>
                    {status === 'accepted' ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleNavigateTask(task)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                          <MapPin size={16} /> {t('common.navigate')}
                        </button>
                        <button
                          onClick={() => openCompletionDialog({
                            kind: 'task',
                            id: task.id,
                            title: task.description ?? `Tarefa em ${task.location_node}`,
                          })}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle size={16} /> Concluir tarefa
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => handleAcceptTask(task.id)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                          <ThumbsUp size={16} /> {t('common.accept')}
                        </button>
                        <button onClick={() => handleNavigateTask(task)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                          <MapPin size={16} /> {t('common.navigate')}
                        </button>
                        <button onClick={() => handleRefuseTask(task.id)} disabled={!!actionLoading} className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                          <X size={16} /> {t('common.refuse')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {routeModal && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center bg-white/45 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Rota operacional</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{routeModal.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  De {routeModal.fromNode} até nó {routeModal.toNode}
                  {routeModalGeoJson
                    ? ` · ${Math.round(routeModalGeoJson.summary.distance)}m · ${Math.max(1, Math.round(routeModalGeoJson.summary.eta_seconds / 60))} min`
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {routeModalGeoJson && routeModalGeoJson.summary.floors.length > 1 && (
                  <div className="flex rounded-2xl bg-slate-100 p-1">
                    {routeModalGeoJson.summary.floors.map((floor) => (
                      <button
                        key={floor}
                        onClick={() => setRouteModalFloor(String(floor) as '0' | '1' | '2')}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                          routeModalFloor === String(floor)
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Piso {floor}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setRouteModal(null);
                    setRouteModalGeoJson(null);
                    setRouteModalError(null);
                  }}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar rota"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {routeModalLoading ? (
                <div className="flex h-[32rem] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  A calcular rota...
                </div>
              ) : routeModalError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  {routeModalError}
                </div>
              ) : (
                <IndoorGisMap
                  floorId={Number(routeModalFloor)}
                  routeGeoJson={routeModalGeoJson?.route ?? null}
                  routeAffected={Boolean(routeModalGeoJson?.summary.impacted_edge_count)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {completionTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Conclusão da tarefa</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">{completionTarget.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Descreve o que foi feito. Este registo fica associado à tua atribuição, não fecha automaticamente o incidente completo.
              </p>
            </div>

            <textarea
              value={completionNotes}
              onChange={(event) => setCompletionNotes(event.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex.: Cheguei ao local, confirmei a ocorrência, zona estabilizada e reporte feito ao supervisor."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
            {completionNotes.trim().length > 0 && completionNotes.trim().length < 3 && (
              <p className="mt-2 text-xs font-medium text-red-600">A descrição tem de ter pelo menos 3 caracteres.</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeCompletionDialog}
                disabled={!!actionLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCompletion()}
                disabled={!!actionLoading || completionNotes.trim().length < 3}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading?.startsWith('complete-') ? 'A concluir...' : 'Concluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
