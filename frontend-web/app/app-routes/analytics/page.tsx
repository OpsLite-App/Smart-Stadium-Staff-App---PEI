'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  AlertCircle,
  Shield,
  Activity,
  Download,
  Calendar,
  Filter
} from 'lucide-react';
import { theme } from '@/lib/theme';
import { Surface } from '@/components/ui/Surface';
import { AppButton } from '@/components/ui/AppButton';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'performance'>('overview');

  // Dados para os gráficos
  const alertTrendData = [
    { name: 'Seg', alerts: 12, resolved: 10 },
    { name: 'Ter', alerts: 19, resolved: 17 },
    { name: 'Qua', alerts: 15, resolved: 14 },
    { name: 'Qui', alerts: 21, resolved: 18 },
    { name: 'Sex', alerts: 24, resolved: 20 },
    { name: 'Sáb', alerts: 18, resolved: 16 },
    { name: 'Dom', alerts: 10, resolved: 9 },
  ];

  const responseTimeData = [
    { time: '00h', security: 3.2, cleaning: 4.1, medical: 2.8 },
    { time: '04h', security: 2.8, cleaning: 3.5, medical: 2.2 },
    { time: '08h', security: 4.1, cleaning: 5.2, medical: 3.5 },
    { time: '12h', security: 4.8, cleaning: 6.1, medical: 4.2 },
    { time: '16h', security: 5.2, cleaning: 5.8, medical: 4.5 },
    { time: '20h', security: 4.5, cleaning: 4.9, medical: 3.8 },
  ];

  const zoneData = [
    { name: 'Portão Norte', value: 35, color: '#EF4444' },
    { name: 'Bancada Sul', value: 28, color: '#F59E0B' },
    { name: 'Área Comercial', value: 22, color: '#10B981' },
    { name: 'Estacionamento', value: 15, color: '#3B82F6' },
  ];

  const teamPerformanceData = [
    { name: 'Segurança', eficiencia: 92, alerts: 145, avgTime: 3.2 },
    { name: 'Limpeza', eficiencia: 88, alerts: 98, avgTime: 4.5 },
    { name: 'Médicos', eficiencia: 96, alerts: 45, avgTime: 2.8 },
    { name: 'Supervisores', eficiencia: 90, alerts: 67, avgTime: 3.8 },
  ];

  const peakHoursData = [
    { hour: '14-15', incidents: 8 },
    { hour: '15-16', incidents: 12 },
    { hour: '16-17', incidents: 18 },
    { hour: '17-18', incidents: 24 },
    { hour: '18-19', incidents: 21 },
    { hour: '19-20', incidents: 15 },
    { hour: '20-21', incidents: 10 },
  ];

  const kpiData = [
    { 
      title: 'Tempo Médio Resposta',
      value: '3:42',
      target: '4:00',
      progress: 92,
      icon: Clock,
      color: '#3B82F6'
    },
    {
      title: 'Alertas Resolvidos',
      value: '1,247',
      target: '1,500',
      progress: 83,
      icon: AlertCircle,
      color: '#10B981'
    },
    {
      title: 'Eficiência Equipa',
      value: '94%',
      target: '90%',
      progress: 104,
      icon: TrendingUp,
      color: '#F59E0B'
    },
    {
      title: 'Staff Ativo',
      value: '28',
      target: '32',
      progress: 87,
      icon: Users,
      color: '#8B5CF6'
    }
  ];

  const getTimeRangeLabel = () => {
    switch(timeRange) {
      case 'today': return 'Hoje';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mês';
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937]">Analytics Dashboard</h1>
            <p className="text-[#6B7280] mt-1">Visão geral do desempenho operacional</p>
          </div>
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => {
                const value = e.target.value as 'today' | 'week' | 'month';
                setTimeRange(value);
              }}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
            >
              <option value="today">Hoje</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mês</option>
            </select>
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-[#1F2937] hover:bg-gray-50 flex items-center gap-2">
              <Download size={16} />
              Exportar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'overview'
                ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'alerts'
                ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Alertas
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${
              activeTab === 'performance'
                ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]'
                : 'text-[#6B7280] hover:text-[#1F2937]'
            }`}
          >
            Performance
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${kpi.color}20` }}>
                  <Icon size={20} color={kpi.color} />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  kpi.progress >= 100 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {kpi.progress >= 100 ? 'Meta Atingida' : `${kpi.progress}%`}
                </span>
              </div>
              <h3 className="text-sm font-medium text-[#6B7280] mb-1">{kpi.title}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#1F2937]">{kpi.value}</span>
                <span className="text-xs text-[#6B7280]">/ {kpi.target}</span>
              </div>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="h-1.5 rounded-full" 
                  style={{ 
                    width: `${Math.min(kpi.progress, 100)}%`,
                    backgroundColor: kpi.color 
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Tendência de Alertas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Tendência de Alertas</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={alertTrendData}>
                <defs>
                  <linearGradient id="alertsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="alerts" stroke="#4F46E5" fill="url(#alertsGradient)" name="Alertas" />
                <Area type="monotone" dataKey="resolved" stroke="#10B981" fill="url(#resolvedGradient)" name="Resolvidos" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tempo de Resposta por Equipa */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Tempo de Resposta (min)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="time" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="security" fill="#3B82F6" name="Segurança" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cleaning" fill="#10B981" name="Limpeza" radius={[4, 4, 0, 0]} />
                <Bar dataKey="medical" fill="#EF4444" name="Médicos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Segunda Linha de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Distribuição por Zona */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Alertas por Zona</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zoneData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {zoneData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {zoneData.map((zone, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                  <span className="text-sm text-[#6B7280]">{zone.name}</span>
                </div>
                <span className="text-sm font-medium text-[#1F2937]">{zone.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Horários de Pico */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Horários de Pico</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" stroke="#6B7280" fontSize={12} />
                <YAxis dataKey="hour" type="category" stroke="#6B7280" fontSize={12} width={50} />
                <Tooltip />
                <Bar dataKey="incidents" fill="#F59E0B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance das Equipas */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Performance das Equipas</h3>
          <div className="space-y-4">
            {teamPerformanceData.map((team, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1F2937]">{team.name}</span>
                  <span className="text-sm text-[#6B7280]">{team.eficiencia}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${team.eficiencia}%`,
                      backgroundColor: 
                        team.name === 'Segurança' ? '#3B82F6' :
                        team.name === 'Limpeza' ? '#10B981' :
                        team.name === 'Médicos' ? '#EF4444' : '#8B5CF6'
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-[#6B7280]">
                  <span>{team.alerts} alertas</span>
                  <span>⏱️ {team.avgTime}min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Eventos Recentes */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1F2937]">Eventos Recentes</h3>
          <button className="text-sm text-[#4F46E5] hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">Hora</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">Tipo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">Local</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">Equipa</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-[#1F2937]">15:32</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">SOS Médico</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Bancada Sul</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Médicos</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Resolvido</span>
                </td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-[#1F2937]">15:15</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Lixeira Cheia</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Área Comercial</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Limpeza</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Em andamento</span>
                </td>
              </tr>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-[#1F2937]">14:50</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Portão Bloqueado</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Portão 5</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Segurança</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Resolvido</span>
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-[#1F2937]">14:22</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Conflito</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Portão 3</td>
                <td className="py-3 px-4 text-sm text-[#1F2937]">Segurança</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Resolvido</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
