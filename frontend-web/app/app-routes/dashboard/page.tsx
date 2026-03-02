// app/app-routes/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useMapStore } from '@/lib/stores/useMapStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  Shield, 
  Brush, 
  UserCog, 
  Users, 
  Trash2, 
  Flame,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Calendar,
  Bell,
  Radio,
  Megaphone,
  DoorOpen,
  Wifi,
  Battery,
  Gauge
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { 
    nodes, 
    bins, 
    staffMembers, 
    heatmapData,
    loading 
  } = useMapStore();

  const [currentTime, setCurrentTime] = useState(new Date());
  const stats = useMemo(() => ({
    activeStaff: staffMembers.length,
    fullBins: bins.length > 0 ? Math.floor(bins.length * 0.3) : 0,
    highRiskAreas: heatmapData.filter((h) => h.weight > 0.7).length,
    completedTasks: Math.max(5, Math.floor(staffMembers.length * 1.2))
  }), [staffMembers, bins, heatmapData]);

  // Atualizar relógio
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Formatar hora
  const formattedTime = currentTime.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const formattedDate = currentTime.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Dashboard para SECURITY
  if (user?.role === 'Security') {
    const recentAlerts = [
      { id: 1, type: 'Movimento suspeito', location: 'Setor A4', time: '2 min', severity: 'high' },
      { id: 2, type: 'Porta de emergência aberta', location: 'Corredor N2', time: '15 min', severity: 'medium' },
      { id: 3, type: 'Concentração de pessoas', location: 'Entrada Norte', time: '25 min', severity: 'low' },
    ];

    const securityStats = [
      { label: 'Equipa Ativa', value: stats.activeStaff, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
      { label: 'Zonas de Risco', value: stats.highRiskAreas, icon: Flame, color: 'text-red-600', bg: 'bg-red-100' },
      { label: 'Câmaras Ativas', value: '24', icon: Radio, color: 'text-green-600', bg: 'bg-green-100' },
      { label: 'Alertas Hoje', value: recentAlerts.length, icon: Bell, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    ];

    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header com Saudação */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Segurança</h1>
            <p className="text-gray-600 mt-1 capitalize">
              {formattedDate} • {formattedTime}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {securityStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bg}`}>
                      <Icon size={24} className={stat.color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mapa de Calor e Alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Alertas Recentes */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Alertas Ativos</h2>
              </div>
              <div className="p-4">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                      <div className={`
                        p-2 rounded-full flex-shrink-0
                        ${alert.severity === 'high' ? 'bg-red-100' : 
                          alert.severity === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'}
                      `}>
                        <AlertTriangle size={16} className={
                          alert.severity === 'high' ? 'text-red-600' : 
                          alert.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                        } />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{alert.type}</p>
                        <p className="text-sm text-gray-500">{alert.location}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-400">Há {alert.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100">
                <button className="w-full text-center text-sm text-[#4F46E5] font-medium hover:text-[#4338CA]">
                  Ver todos os alertas →
                </button>
              </div>
            </div>

            {/* Equipa no Terreno */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Equipa no Terreno</h2>
                <span className="text-sm text-gray-500">{stats.activeStaff} ativos</span>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {staffMembers.slice(0, 5).map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#4F46E5] flex items-center justify-center text-white font-medium">
                          {member.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              {member.role}
                            </span>
                            <span className="text-xs text-gray-500">
                              {member.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-sm text-gray-600">Online</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Instruções Rápidas */}
          <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Protocolo de Segurança Ativo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 text-white">
                <Radio size={24} />
                <div>
                  <p className="font-medium">Canal 1</p>
                  <p className="text-sm text-blue-100">Coordenação</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-white">
                <DoorOpen size={24} />
                <div>
                  <p className="font-medium">Portas N1-N4</p>
                  <p className="text-sm text-blue-100">Verificar status</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-white">
                <Megaphone size={24} />
                <div>
                  <p className="font-medium">Megafones</p>
                  <p className="text-sm text-blue-100">Teste a cada 2h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Dashboard para CLEANING
  if (user?.role === 'Cleaning') {
    // Usar bins diretamente sem status/level
    const urgentBins = bins.slice(0, 5); // Mostra as primeiras 5 lixeiras
    
    const pendingZones = [
      { zone: 'Setor A', priority: 'Alta', time: '30 min', items: 5 },
      { zone: 'Camarotes', priority: 'Média', time: '1h', items: 3 },
      { zone: 'Corredor N2', priority: 'Baixa', time: '2h', items: 2 },
    ];

    const cleaningStats = [
      { label: 'Lixeiras', value: bins.length, icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' },
      { label: 'Zonas Atribuídas', value: '4', icon: MapPin, color: 'text-green-600', bg: 'bg-green-100' },
      { label: 'Tarefas Hoje', value: '12', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100' },
      { label: 'Concluídas', value: '8', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100' },
    ];

    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Limpeza</h1>
            <p className="text-gray-600 mt-1 capitalize">
              {formattedDate} • {formattedTime}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cleaningStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bg}`}>
                      <Icon size={24} className={stat.color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lixeiras */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Lixeiras</h2>
              </div>
              <div className="p-4">
                {urgentBins.map((bin) => (
                  <div key={bin.id} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{bin.name}</p>
                        <p className="text-sm text-gray-500">{bin.category}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          ID: {bin.id}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Zonas Pendentes */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Zonas Pendentes</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {pendingZones.map((zone, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{zone.zone}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`
                            text-xs px-2 py-1 rounded-full
                            ${zone.priority === 'Alta' ? 'bg-red-100 text-red-700' : 
                              zone.priority === 'Média' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-green-100 text-green-700'}
                          `}>
                            {zone.priority}
                          </span>
                          <span className="text-xs text-gray-500">{zone.items} itens</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{zone.time}</p>
                        <p className="text-xs text-gray-500">tempo estimado</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rota Otimizada */}
          <div className="mt-8 bg-gradient-to-r from-green-600 to-green-700 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Rota Otimizada</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-white">
              <div>
                <p className="text-sm text-green-100">Próximo ponto</p>
                <p className="font-medium">{bins[0]?.name || 'Lixeira A1'}</p>
              </div>
              <div>
                <p className="text-sm text-green-100">Distância</p>
                <p className="font-medium">120 metros</p>
              </div>
              <div>
                <p className="text-sm text-green-100">Tempo estimado</p>
                <p className="font-medium">5 minutos</p>
              </div>
              <div>
                <p className="text-sm text-green-100">Prioridade</p>
                <p className="font-medium">Alta</p>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Dashboard para SUPERVISOR
  if (user?.role === 'Supervisor') {
    const supervisorStats = [
      { label: 'Equipa Total', value: stats.activeStaff, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
      { label: 'Segurança', value: '8', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100' },
      { label: 'Limpeza', value: '6', icon: Brush, color: 'text-green-600', bg: 'bg-green-100' },
      { label: 'Performance', value: '94%', icon: Gauge, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    ];

    const teamPerformance = [
      { role: 'Segurança', active: 8, total: 8, tasks: 24, completed: 22 },
      { role: 'Limpeza', active: 5, total: 6, tasks: 18, completed: 15 },
      { role: 'Manutenção', active: 3, total: 4, tasks: 12, completed: 10 },
    ];

    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Supervisão</h1>
            <p className="text-gray-600 mt-1 capitalize">
              {formattedDate} • {formattedTime}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {supervisorStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bg}`}>
                      <Icon size={24} className={stat.color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance da Equipa */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Performance por Equipa</h2>
              </div>
              <div className="p-6">
                {teamPerformance.map((team, index) => (
                  <div key={index} className="mb-6 last:mb-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{team.role}</span>
                      <span className="text-sm text-gray-600">
                        {team.active}/{team.total} ativos
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#4F46E5] h-2 rounded-full" 
                        style={{ width: `${(team.completed / team.tasks) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">{team.completed} tarefas concluídas</span>
                      <span className="text-xs text-gray-500">{team.tasks} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas do Sistema */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Alertas do Sistema</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                    <div className="p-2 bg-yellow-100 rounded-full">
                      <Battery size={16} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Rádios com bateria fraca</p>
                      <p className="text-sm text-gray-500">3 equipamentos precisam de carregamento</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <Wifi size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Rede estável</p>
                      <p className="text-sm text-gray-500">Todos os sensores online</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mapa de Atividades */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Resumo das Operações</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-white">
                <p className="text-sm text-purple-100">Incidentes hoje</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <div className="text-white">
                <p className="text-sm text-purple-100">Tempo médio resposta</p>
                <p className="text-2xl font-bold">4.5min</p>
              </div>
              <div className="text-white">
                <p className="text-sm text-purple-100">Staff em pausa</p>
                <p className="text-2xl font-bold">2</p>
              </div>
              <div className="text-white">
                <p className="text-sm text-purple-100">Satisfação</p>
                <p className="text-2xl font-bold">4.8/5</p>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Fallback
  return (
    <MainLayout>
      <div className="p-6">
        <p>Dashboard não disponível para esta role</p>
      </div>
    </MainLayout>
  );
}
