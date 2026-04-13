'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api, EMERGENCY_SERVICE } from '@/lib/services/api';
import axios from 'axios';
import { CheckCircle, MapPin, RefreshCw, AlertTriangle, X, ThumbsUp } from 'lucide-react';

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
}

type TaskLocalStatus = 'pending' | 'accepted' | 'refused' | 'done';

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

export default function TasksPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { setNavigation } = useNavigationStore();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [dispatches, setDispatches] = useState<IncidentDispatch[]>([]);
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskLocalStatus>>({});
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, TaskLocalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Ocupado se tiver pelo menos uma tarefa/dispatch aceite
  const isBusy = Object.values(taskStatus).some(s => s === 'accepted') ||
                 Object.values(dispatchStatus).some(s => s === 'accepted');

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const myId = String(user.id);
      const [tasksData, allDispatches, allIncidents] = await Promise.all([
        api.getMyTasks(myId),
        axios.get(`${EMERGENCY_SERVICE}/dispatch/active`, { timeout: 6000 })
          .then(r => r.data as IncidentDispatch[]).catch(() => [] as IncidentDispatch[]),
        axios.get(`${EMERGENCY_SERVICE}/incidents`, { timeout: 6000 })
          .then(r => (r.data.incidents ?? r.data) as any[]).catch(() => []),
      ]);

      setTasks(tasksData);

      const myDispatches = (allDispatches).filter(
        d => d.responder_id === myId ||
             d.responder_id === `STAFF_${user.role?.toUpperCase()}_${myId.padStart(3, '0')}`
      );

      const enriched = myDispatches.map(d => {
        const inc = (allIncidents as any[]).find(i => i.id === d.incident_id);
        return {
          ...d,
          incident_type: inc?.incident_type ?? 'incident',
          incident_location: inc?.location_node ?? '?',
          incident_severity: inc?.severity ?? 'medium',
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
  const handleAcceptTask = (taskId: string) => {
    setTaskStatus(prev => ({ ...prev, [taskId]: 'accepted' }));
  };

  const handleRefuseTask = (taskId: string) => {
    setTaskStatus(prev => ({ ...prev, [taskId]: 'refused' }));
  };

  const handleNavigateTask = async (task: MaintenanceTask) => {
    setActionLoading(`nav-${task.id}`);
    try {
      const fromNode = 'N1';
      const route = await api.getRoute(fromNode, task.location_node);
      await api.startTask(task.id);
      setTaskStatus(prev => ({ ...prev, [task.id]: 'accepted' }));
      setNavigation({
        taskId: task.id,
        binId: task.main_metadata?.bin_id ?? task.id,
        binName: task.description ?? `Lixeira ${task.location_node}`,
        targetNode: task.location_node,
        fromNode,
        waypoints: route.waypoints,
        etaSeconds: route.eta_seconds,
      });
      router.push('/app-routes/map');
    } catch {
      alert('Não foi possível calcular a rota.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDoneTask = async (taskId: string) => {
    setActionLoading(`done-${taskId}`);
    try {
      await api.completeTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'done' }));
    } catch {
      alert('Erro ao marcar como concluído.');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Dispatch actions ---
  const handleAcceptDispatch = (dispatchId: string) => {
    setDispatchStatus(prev => ({ ...prev, [dispatchId]: 'accepted' }));
  };

  const handleRefuseDispatch = (dispatchId: string) => {
    setDispatchStatus(prev => ({ ...prev, [dispatchId]: 'refused' }));
  };

  const handleNavigateDispatch = async (d: IncidentDispatch) => {
    setActionLoading(`nav-dispatch-${d.id}`);
    try {
      const fromNode = 'N1';
      await axios.post(`${EMERGENCY_SERVICE}/dispatch/${d.id}/arrived`, {}, { timeout: 5000 }).catch(() => {});
      const waypoints = d.route_nodes.length >= 2
        ? d.route_nodes.map(n => ({ node_id: n, x: 0, y: 0 }))
        : (await api.getRoute(fromNode, d.incident_location ?? 'N1').catch(() => ({ waypoints: [], eta_seconds: 0 }))).waypoints;
      setDispatchStatus(prev => ({ ...prev, [d.id]: 'accepted' }));
      setNavigation({
        taskId: d.id,
        binId: d.incident_id,
        binName: `${d.incident_type?.toUpperCase()} — ${d.incident_location}`,
        targetNode: d.incident_location ?? 'N1',
        fromNode,
        waypoints: waypoints as any,
        etaSeconds: d.eta_seconds,
      });
      router.push('/app-routes/map');
    } catch {
      alert('Não foi possível calcular a rota.');
    } finally {
      setActionLoading(null);
    }
  };

  const activeTasks = tasks.filter(t => taskStatus[t.id] !== 'refused' && taskStatus[t.id] !== 'done');
  const activeDispatches = dispatches.filter(d => dispatchStatus[d.id] !== 'refused');
  const totalCount = activeTasks.length + activeDispatches.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">As minhas tarefas</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-gray-500">
              {totalCount} tarefa{totalCount !== 1 ? 's' : ''} ativa{totalCount !== 1 ? 's' : ''}
            </p>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold border ${
              isBusy
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-orange-500' : 'bg-green-500'}`} />
              {isBusy ? 'Ocupado' : 'Disponível'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">Atualizado às {lastUpdated.toLocaleTimeString('pt-PT')}</span>
          )}
          <button
            onClick={() => { setRefreshing(true); void fetchTasks(); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">A carregar tarefas...</div>
      ) : totalCount === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-medium text-gray-700">Sem tarefas pendentes</p>
          <p className="text-sm text-gray-400 mt-1">Estás em dia! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Emergency dispatches */}
          {activeDispatches.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Incidentes atribuídos</p>
              {activeDispatches.map(d => {
                const status = dispatchStatus[d.id] ?? 'pending';
                return (
                  <div key={d.id} className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-500 shrink-0" />
                        <div>
                          <p className="font-bold text-gray-900 capitalize">{d.incident_type?.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-500">Local: <span className="font-medium">{d.incident_location}</span></p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[d.incident_severity ?? 'medium'] ?? SEVERITY_STYLE.medium}`}>
                        {d.incident_severity}
                      </span>
                    </div>

                    {status === 'accepted' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleNavigateDispatch(d)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <MapPin size={16} /> Navegar
                        </button>
                        <span className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium border border-green-200">
                          <ThumbsUp size={14} /> Aceite
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptDispatch(d.id)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <ThumbsUp size={16} /> Aceitar
                        </button>
                        <button
                          onClick={() => handleNavigateDispatch(d)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <MapPin size={16} /> Navegar
                        </button>
                        <button
                          onClick={() => handleRefuseDispatch(d.id)}
                          disabled={!!actionLoading}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X size={16} /> Recusar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Maintenance tasks */}
          {activeTasks.length > 0 && (
            <div className="space-y-3">
              {activeDispatches.length > 0 && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tarefas de manutenção</p>
              )}
              {activeTasks.map(task => {
                const status = taskStatus[task.id] ?? 'pending';
                return (
                  <div key={task.id} className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {task.description ?? `Lixeira ${task.main_metadata?.bin_id ?? task.location_node}`}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Local: {task.location_node}
                          {task.main_metadata?.fill_percentage != null && (
                            <span className="ml-2 font-medium text-orange-600">{task.main_metadata.fill_percentage}% cheio</span>
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.low}`}>
                        {task.priority}
                      </span>
                    </div>

                    {status === 'accepted' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleNavigateTask(task)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <MapPin size={16} /> Navegar
                        </button>
                        <button
                          onClick={() => handleDoneTask(task.id)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle size={16} /> Feito
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptTask(task.id)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          <ThumbsUp size={16} /> Aceitar
                        </button>
                        <button
                          onClick={() => handleNavigateTask(task)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <MapPin size={16} /> Navegar
                        </button>
                        <button
                          onClick={() => handleRefuseTask(task.id)}
                          disabled={!!actionLoading}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X size={16} /> Recusar
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
    </div>
  );
}
