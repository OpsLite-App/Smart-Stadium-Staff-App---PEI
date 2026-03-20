'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api } from '@/lib/services/api';
import { CheckCircle, MapPin, RefreshCw } from 'lucide-react';

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

const PRIORITY_STYLE: Record<string, string> = {
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await api.getMyTasks(String(user.id));
      setTasks(data);
      setLastUpdated(new Date());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      setRefreshing(true);
      void fetchTasks();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleNavigate = async (task: MaintenanceTask) => {
    setActionLoading(`nav-${task.id}`);
    try {
      const fromNode = 'N1';
      const route = await api.getRoute(fromNode, task.location_node);
      await api.startTask(task.id);
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

  const handleComplete = async (taskId: string) => {
    setActionLoading(`done-${taskId}`);
    try {
      await api.completeTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      alert('Erro ao marcar como concluído.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">As minhas tarefas</h1>
          <p className="text-sm text-gray-500 mt-1">Tarefas atribuídas automaticamente</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-PT')}
            </span>
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

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          A carregar tarefas...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-medium text-gray-700">Sem tarefas pendentes</p>
          <p className="text-sm text-gray-400 mt-1">Estás em dia! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {task.description ?? `Lixeira ${task.main_metadata?.bin_id ?? task.location_node}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Local: {task.location_node}
                    {task.main_metadata?.fill_percentage != null && (
                      <span className="ml-2 font-medium text-orange-600">
                        {task.main_metadata.fill_percentage}% cheio
                      </span>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.low}`}>
                  {task.priority}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleNavigate(task)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <MapPin size={16} />
                  Navegar
                </button>
                <button
                  onClick={() => handleComplete(task.id)}
                  disabled={!!actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  Marcar como feito
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
