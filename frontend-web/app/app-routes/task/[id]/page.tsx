'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useMapStore } from '@/lib/stores/useMapStore';
import { api } from '@/lib/services/api';
import { theme } from '@/lib/theme';
import { 
  ClipboardList,
  MapPin,
  Clock,
  CheckCircle,
  Navigation,
  MessageCircle,
  Users,
  Calendar,
  ChevronLeft,
  AlertCircle,
  Wrench,
  Trash2,
  Droplets,
  ListChecks
} from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface TaskDetails {
  id: string;
  title: string;
  description: string;
  type: 'cleaning' | 'maintenance' | 'bin' | 'inspection';
  location: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  createdBy: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  instructions: string[];
  estimatedTime: number;
  progress: number;
  checklist?: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
}

export default function TaskDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const { requestRoute } = useMapStore();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Array<{id: string; text: string; completed: boolean}>>([]);
  const [updating, setUpdating] = useState(false);

  const taskId = params.id as string;

  useEffect(() => {
    if (taskId) {
      loadTaskDetails();
    }
  }, [taskId]);

  const loadTaskDetails = async () => {
    setLoading(true);
    try {
      // Chamada real à API
      const data = await api.getTaskDetails(taskId);
      setTask(data);
      if (data.checklist) {
        setChecklist(data.checklist);
      }
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar detalhes da tarefa:', err);
      setError('Não foi possível carregar os detalhes da tarefa.');
      
      // Dados mock para desenvolvimento (remover em produção)
      if (process.env.NODE_ENV === 'development') {
        const mockTask: TaskDetails = {
          id: taskId,
          title: 'Lixeira Cheia - Área Comercial',
          description: 'Lixeira com capacidade a 95%. Necessita esvaziamento urgente devido a acumulação de resíduos.',
          type: 'bin',
          location: 'Área Comercial, Piso 1, Corredor Principal',
          priority: 'HIGH',
          status: 'pending',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'Sistema Automático',
          coordinates: {
            lat: 41.161758,
            lng: -8.583933
          },
          instructions: [
            'Dirigir-se à lixeira B03 na área comercial',
            'Verificar nível de enchimento',
            'Substituir saco de lixo',
            'Limpar exterior da lixeira',
            'Registar conclusão no sistema'
          ],
          estimatedTime: 15,
          progress: 0,
          checklist: [
            { id: '1', text: 'Verificar nível da lixeira', completed: false },
            { id: '2', text: 'Substituir saco', completed: false },
            { id: '3', text: 'Limpar exterior', completed: false },
            { id: '4', text: 'Registar no sistema', completed: false }
          ]
        };
        setTask(mockTask);
        setChecklist(mockTask.checklist || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setUpdating(true);
      await api.updateTaskStatus(taskId, 'in-progress');
      setTask(prev => prev ? { ...prev, status: 'in-progress' } : null);
    } catch (err) {
      console.error('Erro ao iniciar tarefa:', err);
      alert('Erro ao iniciar tarefa. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    try {
      setUpdating(true);
      await api.updateTaskStatus(taskId, 'completed');
      alert('Tarefa concluída com sucesso!');
      router.push('/app-routes/alerts');
    } catch (err) {
      console.error('Erro ao completar tarefa:', err);
      alert('Erro ao completar tarefa. Tente novamente.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRoute = () => {
    if (task?.coordinates) {
      const fromNode = user?.id ? `staff-${user.id}` : 'current';
      const toNode = `task-${taskId}`;
      requestRoute(fromNode, toNode);
      router.push('/app-routes/map');
    }
  };

  const handleChat = () => {
    router.push(`/app-routes/chat?task=${taskId}`);
  };

  const handleChecklistToggle = async (itemId: string) => {
    const updatedChecklist = checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedChecklist);

    try {
      await api.updateTaskChecklist(taskId, updatedChecklist);
      
      // Atualizar progresso
      const completedCount = updatedChecklist.filter(i => i.completed).length;
      const progress = Math.round((completedCount / updatedChecklist.length) * 100);
      
      setTask(prev => prev ? { ...prev, progress } : null);
      
      if (progress === 100 && task?.status !== 'completed') {
        await api.updateTaskStatus(taskId, 'completed');
        setTask(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    } catch (err) {
      console.error('Erro ao atualizar checklist:', err);
    }
  };

  const getTaskIcon = () => {
    switch(task?.type) {
      case 'cleaning': return <Droplets size={24} className="text-[#10B981]" />;
      case 'maintenance': return <Wrench size={24} className="text-[#F59E0B]" />;
      case 'bin': return <Trash2 size={24} className="text-[#4F46E5]" />;
      default: return <ClipboardList size={24} className="text-[#6B7280]" />;
    }
  };

  const getPriorityColor = () => {
    switch(task?.priority) {
      case 'HIGH': return '#EF4444';
      case 'MEDIUM': return '#F59E0B';
      case 'LOW': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusBadge = () => {
    switch(task?.status) {
      case 'pending': return <Badge variant="warning">Pendente</Badge>;
      case 'in-progress': return <Badge variant="primary">Em Andamento</Badge>;
      case 'completed': return <Badge variant="success">Concluído</Badge>;
      case 'cancelled': return <Badge variant="error">Cancelado</Badge>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
          <p className="text-[#6B7280]">A carregar detalhes da tarefa...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1F2937] mb-2">Erro ao carregar</h2>
          <p className="text-[#6B7280] mb-6">{error || 'Tarefa não encontrada'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-lg text-[#1F2937] font-medium hover:bg-gray-50 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] pb-24">
      {/* Header com back button */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-[#1F2937]" />
          </button>
          <h1 className="text-lg font-semibold text-[#1F2937]">Detalhes da Tarefa</h1>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4 max-w-3xl mx-auto">
        {/* Card Principal */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-1 h-12 rounded-full"
                style={{ backgroundColor: getPriorityColor() }}
              />
              <div>
                <h2 className="text-xl font-bold text-[#1F2937]">{task.title}</h2>
                <p className="text-sm text-[#6B7280] mt-1">ID: #{task.id}</p>
              </div>
            </div>
            {getStatusBadge()}
          </div>

          <div className="flex items-center gap-2 text-[#6B7280] mb-4">
            <MapPin size={16} />
            <span className="text-sm">{task.location}</span>
          </div>

          <p className="text-[#1F2937] leading-relaxed mb-4">
            {task.description}
          </p>

          {/* Barra de Progresso */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#6B7280]">Progresso</span>
              <span className="text-xs font-medium text-[#1F2937]">{task.progress}%</span>
            </div>
            <ProgressBar 
              value={task.progress}
              size="md"
            />
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">
            INFORMAÇÕES
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <ListChecks size={16} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Tipo</p>
                <p className="text-sm font-medium text-[#1F2937] capitalize">{task.type}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users size={16} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Atribuído a</p>
                <p className="text-sm font-medium text-[#1F2937]">{task.assignedTo || 'Não atribuído'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Clock size={16} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Tempo estimado</p>
                <p className="text-sm font-medium text-[#1F2937]">{task.estimatedTime} minutos</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Calendar size={16} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Criado em</p>
                <p className="text-sm font-medium text-[#1F2937]">
                  {new Date(task.createdAt).toLocaleString('pt-PT')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">
            INSTRUÇÕES
          </h3>
          
          <ol className="list-decimal list-inside space-y-2">
            {task.instructions.map((instruction, index) => (
              <li key={index} className="text-sm text-[#1F2937]">
                {instruction}
              </li>
            ))}
          </ol>
        </div>

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
            <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">
              CHECKLIST
            </h3>
            
            <div className="space-y-3">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleChecklistToggle(item.id)}
                    className="mt-1 w-4 h-4 text-[#4F46E5] rounded border-gray-300 focus:ring-[#4F46E5]"
                  />
                  <span className={`text-sm ${item.completed ? 'line-through text-[#9CA3AF]' : 'text-[#1F2937]'}`}>
                    {item.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            {task.status === 'pending' && (
              <button
                onClick={handleStart}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#10B981] text-white rounded-lg font-medium hover:bg-[#059669] transition-colors disabled:opacity-50"
              >
                <CheckCircle size={20} />
                INICIAR
              </button>
            )}

            {task.status === 'in-progress' && (
              <button
                onClick={handleComplete}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#10B981] text-white rounded-lg font-medium hover:bg-[#059669] transition-colors disabled:opacity-50"
              >
                <CheckCircle size={20} />
                CONCLUIR
              </button>
            )}

            <button
              onClick={handleRoute}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#3B82F6] text-white rounded-lg font-medium hover:bg-[#2563EB] transition-colors"
            >
              <Navigation size={20} />
              ROTA
            </button>

            <button
              onClick={handleChat}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors"
            >
              <MessageCircle size={20} />
              CHAT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}