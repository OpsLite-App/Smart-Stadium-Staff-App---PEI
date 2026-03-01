// app/app-routes/alerts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api, CONGESTION_SERVICE, EMERGENCY_SERVICE, AUTH_SERVICE } from '@/lib/services/api';
import axios from 'axios';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Shield,
  Brush,
  UserCog,
  Flame,
  Wifi,
  WifiOff,
  RefreshCw,
  Filter,
  XCircle,
  AlertCircle,
  Radio,
  DoorOpen,
  Megaphone,
  Droplets,
  Users,
  Zap,
  FlameKindling,
  Ban,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';

// Tipos de alerta
interface Alert {
  id: string;
  type: 'security' | 'cleaning' | 'emergency' | 'system' | 'crowd' | 'maintenance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: string;
  location_details?: {
    node_id?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    area?: string;
    gate?: string;
  };
  timestamp: string;
  read: boolean;
  acknowledged: boolean;
  acknowledged_by?: {
    id: number;
    name: string;
    role: string;
  };
  resolved: boolean;
  resolved_at?: string;
  assigned_to?: {
    id: number;
    name: string;
    role: string;
  };
  source: 'api' | 'websocket' | 'system';
  metadata?: Record<string, any>;
}

// Estatísticas de alertas
interface AlertStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  unread: number;
  unresolved: number;
  byType: {
    security: number;
    cleaning: number;
    emergency: number;
    system: number;
    crowd: number;
    maintenance: number;
  };
}

export default function AlertsPage() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unread: 0,
    unresolved: 0,
    byType: {
      security: 0,
      cleaning: 0,
      emergency: 0,
      system: 0,
      crowd: 0,
      maintenance: 0
    }
  });

  // Filtros
  const [filters, setFilters] = useState({
    severity: [] as string[],
    type: [] as string[],
    showResolved: false,
    showRead: true,
    timeRange: 'all' as 'all' | 'today' | 'hour' | '24h'
  });

  // Estados para expansão
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Carregar alertas da API
  const fetchAlerts = async () => {
    try {
      setRefreshing(true);
      console.log('🔍 A buscar alertas...');

      // Tentar buscar de múltiplas fontes
      const sources = [
        { url: `${CONGESTION_SERVICE}/api/alerts`, name: 'Congestion Service' },
        { url: `${EMERGENCY_SERVICE}/api/alerts`, name: 'Emergency Service' },
        { url: `${AUTH_SERVICE}/auth/alerts`, name: 'Auth Service' }
      ];

      let allAlerts: Alert[] = [];
      let hasData = false;

      for (const source of sources) {
        try {
          console.log(`📡 A tentar ${source.name}...`);
          const response = await axios.get(source.url, { timeout: 3000 });
          
          if (response.data && Array.isArray(response.data)) {
            console.log(`✅ ${source.name}: ${response.data.length} alertas`);
            allAlerts = [...allAlerts, ...response.data];
            hasData = true;
          } else if (response.data && response.data.alerts) {
            console.log(`✅ ${source.name}: ${response.data.alerts.length} alertas`);
            allAlerts = [...allAlerts, ...response.data.alerts];
            hasData = true;
          }
        } catch (error) {
          console.warn(`⚠️ ${source.name} indisponível`);
        }
      }

      // Se não conseguiu dados reais, usar dados mock
      if (!hasData || allAlerts.length === 0) {
        console.log('📊 Usando dados mock de alertas');
        allAlerts = generateMockAlerts();
      }

      // Ordenar por timestamp (mais recentes primeiro)
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlerts(allAlerts);
      calculateStats(allAlerts);
      
    } catch (error) {
      console.error('❌ Erro ao buscar alertas:', error);
      // Fallback para dados mock
      const mockAlerts = generateMockAlerts();
      setAlerts(mockAlerts);
      calculateStats(mockAlerts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gerar dados mock para desenvolvimento
  const generateMockAlerts = (): Alert[] => {
    const now = new Date();
    const alerts: Alert[] = [
      {
        id: '1',
        type: 'security',
        severity: 'critical',
        title: 'Movimento suspeito detectado',
        description: 'Câmeras detectaram movimento não autorizado na área VIP. Equipa de segurança dirigiu-se ao local.',
        location: 'Setor VIP - Camarotes',
        location_details: {
          node_id: 'VIP-01',
          coordinates: { lat: 41.161758, lng: -8.583933 },
          area: 'VIP'
        },
        timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
        read: false,
        acknowledged: true,
        acknowledged_by: {
          id: 101,
          name: 'Carlos Segurança',
          role: 'Security'
        },
        resolved: false,
        source: 'api',
        metadata: { camera_id: 'CAM-12', confidence: 0.92 }
      },
      {
        id: '2',
        type: 'emergency',
        severity: 'critical',
        title: 'ALERTA DE EMERGÊNCIA - PORTA ABERTA',
        description: 'Porta de emergência N2 foi aberta. Protocolo de evacuação iniciado automaticamente.',
        location: 'Corredor N2 - Saída Este',
        location_details: {
          node_id: 'N2',
          coordinates: { lat: 41.161850, lng: -8.584200 },
          gate: 'N2'
        },
        timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
        read: true,
        acknowledged: true,
        acknowledged_by: {
          id: 102,
          name: 'Maria Supervisor',
          role: 'Supervisor'
        },
        resolved: true,
        resolved_at: new Date(now.getTime() - 10 * 60000).toISOString(),
        source: 'websocket'
      },
      {
        id: '3',
        type: 'cleaning',
        severity: 'high',
        title: 'Lixeira cheia - Ação necessária',
        description: 'Lixeira no Setor A4 está com 95% de capacidade. Necessário esvaziamento urgente.',
        location: 'Setor A4 - Corredor Principal',
        location_details: {
          node_id: 'A4-BIN',
          coordinates: { lat: 41.161450, lng: -8.584500 },
          area: 'Setor A'
        },
        timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
        read: false,
        acknowledged: false,
        resolved: false,
        assigned_to: {
          id: 201,
          name: 'Ana Limpeza',
          role: 'Cleaning'
        },
        source: 'api',
        metadata: { fill_level: 95, bin_type: 'general' }
      },
      {
        id: '4',
        type: 'crowd',
        severity: 'high',
        title: 'Alta concentração de pessoas',
        description: 'Densidade de multidão acima do normal na Entrada Norte. Risco de congestionamento.',
        location: 'Entrada Norte - Bilheteira',
        location_details: {
          node_id: 'ENT-N',
          coordinates: { lat: 41.162000, lng: -8.584000 },
          area: 'Entradas'
        },
        timestamp: new Date(now.getTime() - 75 * 60000).toISOString(),
        read: true,
        acknowledged: true,
        acknowledged_by: {
          id: 103,
          name: 'João Segurança',
          role: 'Security'
        },
        resolved: false,
        source: 'api',
        metadata: { density: 0.85, capacity: 500, current: 425 }
      },
      {
        id: '5',
        type: 'system',
        severity: 'medium',
        title: 'Câmara offline',
        description: 'Câmara de segurança CAM-08 no Setor B está offline. Equipa técnica notificada.',
        location: 'Setor B - Zona Sul',
        location_details: {
          node_id: 'B-CAM',
          coordinates: { lat: 41.161200, lng: -8.583500 }
        },
        timestamp: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
        read: true,
        acknowledged: true,
        acknowledged_by: {
          id: 104,
          name: 'Pedro TI',
          role: 'Supervisor'
        },
        resolved: false,
        source: 'system',
        metadata: { camera_id: 'CAM-08', last_seen: new Date(now.getTime() - 3 * 60 * 60000).toISOString() }
      },
      {
        id: '6',
        type: 'security',
        severity: 'low',
        title: 'Acesso não autorizado (teste)',
        description: 'Tentativa de acesso não autorizado à área restrita. Controlo de acessos registou a ocorrência.',
        location: 'Área Restrita - Piso 1',
        location_details: {
          node_id: 'REST-1'
        },
        timestamp: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
        read: true,
        acknowledged: true,
        resolved: true,
        resolved_at: new Date(now.getTime() - 2.5 * 60 * 60000).toISOString(),
        source: 'api'
      },
      {
        id: '7',
        type: 'maintenance',
        severity: 'medium',
        title: 'Manutenção preventiva necessária',
        description: 'Sistema de ar condicionado no Setor VIP necessita de manutenção preventiva.',
        location: 'Setor VIP - Zona Climatizada',
        timestamp: new Date(now.getTime() - 4 * 60 * 60000).toISOString(),
        read: false,
        acknowledged: false,
        resolved: false,
        source: 'system',
        metadata: { system: 'HVAC', last_maintenance: new Date(now.getTime() - 30 * 24 * 60 * 60000).toISOString() }
      },
      {
        id: '8',
        type: 'cleaning',
        severity: 'info',
        title: 'Kit de limpeza necessário',
        description: 'Equipa de limpeza no Setor C necessita de reposição de materiais.',
        location: 'Setor C - Depósito',
        timestamp: new Date(now.getTime() - 5 * 60 * 60000).toISOString(),
        read: false,
        acknowledged: false,
        resolved: false,
        source: 'api'
      }
    ];

    return alerts;
  };

  // Calcular estatísticas
  const calculateStats = (alertList: Alert[]) => {
    const newStats: AlertStats = {
      total: alertList.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      unread: 0,
      unresolved: 0,
      byType: {
        security: 0,
        cleaning: 0,
        emergency: 0,
        system: 0,
        crowd: 0,
        maintenance: 0
      }
    };

    alertList.forEach(alert => {
      // Contagem por severidade
      switch (alert.severity) {
        case 'critical': newStats.critical++; break;
        case 'high': newStats.high++; break;
        case 'medium': newStats.medium++; break;
        case 'low': newStats.low++; break;
        case 'info': newStats.info++; break;
      }

      // Contagem por tipo
      if (alert.type in newStats.byType) {
        newStats.byType[alert.type as keyof typeof newStats.byType]++;
      }

      // Não lidos
      if (!alert.read) newStats.unread++;

      // Não resolvidos
      if (!alert.resolved) newStats.unresolved++;
    });

    setStats(newStats);
  };

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...alerts];

    // Filtrar por severidade
    if (filters.severity.length > 0) {
      filtered = filtered.filter(alert => filters.severity.includes(alert.severity));
    }

    // Filtrar por tipo
    if (filters.type.length > 0) {
      filtered = filtered.filter(alert => filters.type.includes(alert.type));
    }

    // Filtrar resolvidos
    if (!filters.showResolved) {
      filtered = filtered.filter(alert => !alert.resolved);
    }

    // Filtrar lidos
    if (!filters.showRead) {
      filtered = filtered.filter(alert => !alert.read);
    }

    // Filtrar por tempo
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const threshold = new Date();

      switch (filters.timeRange) {
        case 'hour':
          threshold.setHours(now.getHours() - 1);
          break;
        case '24h':
          threshold.setHours(now.getHours() - 24);
          break;
        case 'today':
          threshold.setHours(0, 0, 0, 0);
          break;
      }

      filtered = filtered.filter(alert => new Date(alert.timestamp) >= threshold);
    }

    setFilteredAlerts(filtered);
  }, [alerts, filters]);

  // Carregar alertas ao montar componente
  useEffect(() => {
    fetchAlerts();

    // WebSocket para alertas em tempo real
    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket(`ws://${process.env.NEXT_PUBLIC_API_IP || '192.168.1.137'}:8089/ws/alerts`);
      
      ws.onmessage = (event) => {
        try {
          const newAlert = JSON.parse(event.data) as Alert;
          console.log('🔔 Novo alerta em tempo real:', newAlert);
          
          setAlerts(prev => {
            // Verificar se já existe
            const exists = prev.some(a => a.id === newAlert.id);
            if (exists) return prev;
            
            // Adicionar novo alerta
            const updated = [newAlert, ...prev];
            calculateStats(updated);
            return updated;
          });
        } catch (e) {
          console.error('Erro ao processar websocket:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.warn('⚠️ WebSocket de alertas não disponível:', error);
      };
    } catch (error) {
      console.warn('⚠️ WebSocket não suportado');
    }

    // Refresh automático a cada 30 segundos
    const interval = setInterval(fetchAlerts, 30000);

    return () => {
      if (ws) ws.close();
      clearInterval(interval);
    };
  }, []);

  // Marcar alerta como lido
  const markAsRead = (alertId: string) => {
    setAlerts(prev => {
      const updated = prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      );
      calculateStats(updated);
      return updated;
    });
  };

  // Marcar alerta como reconhecido
  const acknowledgeAlert = async (alertId: string) => {
    if (!user) return;

    try {
      // Tentar enviar confirmação para API
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Alerta reconhecido (dev mode):', alertId);
      } else {
        await axios.post(`${CONGESTION_SERVICE}/api/alerts/${alertId}/acknowledge`, {
          user_id: user.id,
          user_name: user.email?.split('@')[0] || 'Staff'
        });
      }

      // Atualizar localmente
      setAlerts(prev => {
        const updated = prev.map(alert => 
          alert.id === alertId ? { 
            ...alert, 
            acknowledged: true,
            acknowledged_by: {
              id: user.id || 0,
              name: user.email?.split('@')[0] || 'Staff',
              role: user.role
            }
          } : alert
        );
        calculateStats(updated);
        return updated;
      });
    } catch (error) {
      console.error('Erro ao reconhecer alerta:', error);
      
      // Fallback: atualizar localmente mesmo assim
      setAlerts(prev => {
        const updated = prev.map(alert => 
          alert.id === alertId ? { 
            ...alert, 
            acknowledged: true,
            acknowledged_by: {
              id: user.id || 0,
              name: user.email?.split('@')[0] || 'Staff',
              role: user.role
            }
          } : alert
        );
        calculateStats(updated);
        return updated;
      });
    }
  };

  // Resolver alerta
  const resolveAlert = async (alertId: string) => {
    if (!user) return;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Alerta resolvido (dev mode):', alertId);
      } else {
        await axios.post(`${CONGESTION_SERVICE}/api/alerts/${alertId}/resolve`, {
          user_id: user.id,
          resolved_at: new Date().toISOString()
        });
      }

      setAlerts(prev => {
        const updated = prev.map(alert => 
          alert.id === alertId ? { 
            ...alert, 
            resolved: true,
            resolved_at: new Date().toISOString()
          } : alert
        );
        calculateStats(updated);
        return updated;
      });
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      
      // Fallback
      setAlerts(prev => {
        const updated = prev.map(alert => 
          alert.id === alertId ? { 
            ...alert, 
            resolved: true,
            resolved_at: new Date().toISOString()
          } : alert
        );
        calculateStats(updated);
        return updated;
      });
    }
  };

  // Toggle filtro de severidade
  const toggleSeverityFilter = (severity: string) => {
    setFilters(prev => ({
      ...prev,
      severity: prev.severity.includes(severity)
        ? prev.severity.filter(s => s !== severity)
        : [...prev.severity, severity]
    }));
  };

  // Toggle filtro de tipo
  const toggleTypeFilter = (type: string) => {
    setFilters(prev => ({
      ...prev,
      type: prev.type.includes(type)
        ? prev.type.filter(t => t !== type)
        : [...prev.type, type]
    }));
  };

  // Reset filtros
  const resetFilters = () => {
    setFilters({
      severity: [],
      type: [],
      showResolved: false,
      showRead: true,
      timeRange: 'all'
    });
  };

  // Formatar tempo relativo
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} h`;
    return `Há ${diffDays} dias`;
  };

  // Obter ícone do tipo de alerta
  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'security': return Shield;
      case 'cleaning': return Brush;
      case 'emergency': return AlertTriangle;
      case 'system': return Wifi;
      case 'crowd': return Users;
      case 'maintenance': return Zap;
      default: return Bell;
    }
  };

  // Obter cor do tipo de alerta
  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'security': return 'text-blue-600 bg-blue-100';
      case 'cleaning': return 'text-green-600 bg-green-100';
      case 'emergency': return 'text-red-600 bg-red-100';
      case 'system': return 'text-purple-600 bg-purple-100';
      case 'crowd': return 'text-yellow-600 bg-yellow-100';
      case 'maintenance': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Obter cor da severidade
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      case 'info': return 'bg-gray-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  // Obter ícone da severidade
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return AlertTriangle;
      case 'high': return AlertCircle;
      case 'medium': return AlertCircle;
      case 'low': return AlertCircle;
      case 'info': return Bell;
      default: return Bell;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar alertas...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alertas</h1>
            <p className="text-gray-600 mt-1">
              {stats.unread} não lidos • {stats.unresolved} não resolvidos
            </p>
          </div>
          
          <div className="flex gap-2 mt-4 md:mt-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Filter size={18} />
              Filtros
              {(filters.severity.length > 0 || filters.type.length > 0 || filters.timeRange !== 'all') && (
                <span className="ml-1 w-2 h-2 bg-[#4F46E5] rounded-full"></span>
              )}
            </button>
            
            <button
              onClick={fetchAlerts}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Críticos</p>
            <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600">Altos</p>
            <p className="text-2xl font-bold text-gray-900">{stats.high}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600">Médios</p>
            <p className="text-2xl font-bold text-gray-900">{stats.medium}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Baixos</p>
            <p className="text-2xl font-bold text-gray-900">{stats.low}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-500">
            <p className="text-sm text-gray-600">Info</p>
            <p className="text-2xl font-bold text-gray-900">{stats.info}</p>
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Filtros</h2>
              <button
                onClick={resetFilters}
                className="text-sm text-[#4F46E5] hover:text-[#4338CA]"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Filtro por Severidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Severidade
                </label>
                <div className="space-y-2">
                  {['critical', 'high', 'medium', 'low', 'info'].map((sev) => (
                    <label key={sev} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.severity.includes(sev)}
                        onChange={() => toggleSeverityFilter(sev)}
                        className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                      />
                      <span className="text-sm text-gray-700 capitalize">{sev}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtro por Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo
                </label>
                <div className="space-y-2">
                  {['security', 'cleaning', 'emergency', 'system', 'crowd', 'maintenance'].map((type) => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.type.includes(type)}
                        onChange={() => toggleTypeFilter(type)}
                        className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                      />
                      <span className="text-sm text-gray-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Outros filtros */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Período
                </label>
                <select
                  value={filters.timeRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as any }))}
                  className="w-full rounded-lg border-gray-300 text-gray-700 mb-4"
                >
                  <option value="all">Todo o período</option>
                  <option value="today">Hoje</option>
                  <option value="24h">Últimas 24h</option>
                  <option value="hour">Última hora</option>
                </select>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.showResolved}
                      onChange={(e) => setFilters(prev => ({ ...prev, showResolved: e.target.checked }))}
                      className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <span className="text-sm text-gray-700">Mostrar resolvidos</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.showRead}
                      onChange={(e) => setFilters(prev => ({ ...prev, showRead: e.target.checked }))}
                      className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <span className="text-sm text-gray-700">Mostrar lidos</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Alertas */}
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Bell size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sem alertas</h3>
            <p className="text-gray-600">
              Não há alertas para mostrar com os filtros atuais.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map((alert) => {
              const TypeIcon = getAlertTypeIcon(alert.type);
              const SeverityIcon = getSeverityIcon(alert.severity);
              const isExpanded = expandedAlert === alert.id;
              const timeAgo = formatRelativeTime(alert.timestamp);

              return (
                <div
                  key={alert.id}
                  className={`bg-white rounded-lg shadow-sm border transition-all ${
                    alert.severity === 'critical' ? 'border-l-4 border-l-red-500' :
                    alert.severity === 'high' ? 'border-l-4 border-l-orange-500' :
                    alert.severity === 'medium' ? 'border-l-4 border-l-yellow-500' :
                    alert.severity === 'low' ? 'border-l-4 border-l-blue-500' :
                    'border-l-4 border-l-gray-500'
                  } ${!alert.read ? 'bg-blue-50' : ''}`}
                >
                  <div className="p-6">
                    {/* Header do Alerta */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${getAlertTypeColor(alert.type)}`}>
                          <TypeIcon size={20} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getSeverityColor(alert.severity)}`}>
                              {alert.severity.toUpperCase()}
                            </span>
                            {!alert.read && (
                              <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                                NOVO
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-700 text-sm mb-2">{alert.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {alert.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {timeAgo}
                            </span>
                            {alert.acknowledged && alert.acknowledged_by && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCheck size={12} />
                                Reconhecido por {alert.acknowledged_by.name}
                              </span>
                            )}
                            {alert.resolved && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle size={12} />
                                Resolvido
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>

                    {/* Detalhes Expandidos */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Detalhes</h4>
                            <dl className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <dt className="text-gray-500">ID:</dt>
                                <dd className="text-gray-900">{alert.id}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-500">Tipo:</dt>
                                <dd className="text-gray-900 capitalize">{alert.type}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-500">Fonte:</dt>
                                <dd className="text-gray-900 capitalize">{alert.source}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-500">Timestamp:</dt>
                                <dd className="text-gray-900">{new Date(alert.timestamp).toLocaleString()}</dd>
                              </div>
                            </dl>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Localização</h4>
                            <dl className="space-y-2 text-sm">
                              {alert.location_details?.node_id && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-500">Node ID:</dt>
                                  <dd className="text-gray-900">{alert.location_details.node_id}</dd>
                                </div>
                              )}
                              {alert.location_details?.area && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-500">Área:</dt>
                                  <dd className="text-gray-900">{alert.location_details.area}</dd>
                                </div>
                              )}
                              {alert.location_details?.gate && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-500">Porta:</dt>
                                  <dd className="text-gray-900">{alert.location_details.gate}</dd>
                                </div>
                              )}
                              {alert.location_details?.coordinates && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-500">Coordenadas:</dt>
                                  <dd className="text-gray-900">
                                    {alert.location_details.coordinates.lat.toFixed(6)}, 
                                    {alert.location_details.coordinates.lng.toFixed(6)}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        </div>

                        {/* Metadados adicionais */}
                        {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Metadados</h4>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <pre className="text-xs text-gray-600 overflow-auto">
                                {JSON.stringify(alert.metadata, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Ações */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                          {!alert.read && (
                            <button
                              onClick={() => markAsRead(alert.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                              <Eye size={14} />
                              Marcar como lido
                            </button>
                          )}
                          
                          {!alert.acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                            >
                              <CheckCheck size={14} />
                              Reconhecer
                            </button>
                          )}
                          
                          {!alert.resolved && (
                            <button
                              onClick={() => resolveAlert(alert.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            >
                              <CheckCircle size={14} />
                              Marcar como resolvido
                            </button>
                          )}
                          
                          {alert.location_details?.coordinates && (
                            <button
                              onClick={() => {
                                // Abrir no mapa
                                window.location.href = `/app-routes/map?lat=${alert.location_details?.coordinates?.lat}&lng=${alert.location_details?.coordinates?.lng}`;
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                            >
                              <MapPin size={14} />
                              Ver no mapa
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}