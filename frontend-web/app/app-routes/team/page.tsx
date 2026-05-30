// app/app-routes/team/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { api, EMERGENCY_EVENTS_URL } from '@/lib/services/api';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import {
  User,
  Users,
  Shield,
  Zap,
  Brush,
  UserCog,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  Phone,
  Mail,
  Search,
  Filter,
  RefreshCw,
  UserPlus,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Radio,
  Camera,
  MessageSquare,
  Navigation,
  Star,
  TrendingUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Download,
  BatteryIcon,
  Printer
} from 'lucide-react';

// Tipos de membros da equipa
interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical' | 'Maintenance' | 'Staff';
  status: 'active' | 'offline' | 'break' | 'busy' | 'training';
  location: string;
  location_details?: {
    node_id: string;
    area: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  last_active: string;
  shift: {
    start: string;
    end: string;
    type: 'morning' | 'afternoon' | 'night';
  };
  metrics: {
    tasks_completed: number;
    tasks_pending: number;
    response_time: number; // em minutos
    satisfaction: number; // 0-100
    attendance: number; // percentagem
    alerts_handled: number;
  };
  device: {
    id: string;
    type: 'mobile' | 'radio' | 'tablet';
    battery: number; // percentagem
    status: 'online' | 'offline' | 'charging';
    last_sync: string;
  };
  skills: string[];
  certifications: string[];
  emergency_contact?: {
    name: string;
    phone: string;
    relation: string;
  };
  avatar?: string;
}

// Estatísticas da equipa
interface TeamStats {
  total: number;
  active: number;
  offline: number;
  onBreak: number;
  busy: number;
  training: number;
  byRole: {
    Security: number;
    Cleaning: number;
    Supervisor: number;
    Medical: number;
    Maintenance: number;
    Staff: number;
  };
  byLocation: Record<string, number>;
  averageResponseTime: number;
  tasksCompleted: number;
  tasksPending: number;
}

// Grupos de equipa
interface TeamGroup {
  id: string;
  name: string;
  role: string;
  members: TeamMember[];
  leader?: TeamMember;
  location: string;
}

interface ApiStaffMember {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  status?: TeamMember['status'];
  location?: string;
  last_active?: string;
  tasks_completed?: number;
  tasks_pending?: number;
}

function toTeamRole(role: string | undefined): TeamMember['role'] {
  const allowedRoles: TeamMember['role'][] = ['Security', 'Cleaning', 'Supervisor', 'Medical', 'Maintenance', 'Staff'];
  return allowedRoles.includes(role as TeamMember['role']) ? (role as TeamMember['role']) : 'Staff';
}

export default function TeamPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { currentNode, setNavigation } = useNavigationStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<TeamStats>({
    total: 0,
    active: 0,
    offline: 0,
    onBreak: 0,
    busy: 0,
    training: 0,
    byRole: {
      Security: 0,
      Cleaning: 0,
      Supervisor: 0,
      Medical: 0,
      Maintenance: 0,
      Staff: 0
    },
    byLocation: {},
    averageResponseTime: 0,
    tasksCompleted: 0,
    tasksPending: 0
  });

  // Estados para UI
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [locatingMember, setLocatingMember] = useState<TeamMember | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Filtros
  const [filters, setFilters] = useState({
    roles: [] as string[],
    status: [] as string[],
    locations: [] as string[],
    showOffline: true,
    minBattery: 0,
    sortBy: 'name' as 'name' | 'status' | 'location' | 'tasks'
  });

  // Grupos de equipa (gerados dinamicamente)
  const [groups, setGroups] = useState<TeamGroup[]>([]);

  const numericNode = (value?: string | null) => {
    if (!value) return null;
    const match = String(value).match(/\d+/);
    return match ? match[0] : null;
  };

  const handleSendMessage = (member: TeamMember) => {
    router.push(`/app-routes/chat?staffId=${encodeURIComponent(String(member.id))}`);
  };

  const handleLocateMember = (member: TeamMember) => {
    setLocatingMember(member);
  };

  const getMemberFloor = (member: TeamMember) => {
    const node = Number(numericNode(member.location_details?.node_id || member.location));
    return node >= 70 ? 2 : 1;
  };

  const handleNavigateToMember = async (member: TeamMember) => {
    const targetNode = numericNode(member.location_details?.node_id || member.location);
    const fromNode = numericNode(currentNode) || '62';

    if (!targetNode) return;

    try {
      const route = await api.getRoute(fromNode, targetNode);
      setNavigation({
        taskId: `staff-location-${member.id}`,
        binId: String(member.id),
        binName: `Localizar ${member.name}`,
        targetNode,
        fromNode,
        waypoints: route.waypoints,
        etaSeconds: route.eta_seconds,
      });
    } catch {
      setNavigation({
        taskId: `staff-location-${member.id}`,
        binId: String(member.id),
        binName: `Localizar ${member.name}`,
        targetNode,
        fromNode,
        waypoints: [],
        etaSeconds: 0,
      });
    }

    router.push('/app-routes/map');
  };

  // Carregar membros da equipa
  const fetchTeamMembers = async () => {
    try {
      setRefreshing(true);
      console.log('👥 A buscar equipa...');

      // Tentar buscar da API real
      let teamMembers: TeamMember[] = [];

      try {
        const staffList = await api.getStaff() as ApiStaffMember[];
        if (Array.isArray(staffList)) {
          console.log(`✅ API respondeu com ${staffList.length} membros`);
          
          // Mapear resposta da API para o formato TeamMember
          teamMembers = staffList.map((staff, index) => ({
            id: staff.id ?? 10000 + index,
            name: staff.name || `Staff ${staff.id || 'N/A'}`,
            email: staff.email || `${(staff.name || 'staff').toLowerCase().replace(' ', '.')}@fcp.pt`,
            role: toTeamRole(staff.role),
            status: staff.status || 'active',
            location: staff.location || 'Estádio',
            last_active: staff.last_active || new Date().toISOString(),
            shift: {
              start: '08:00',
              end: '16:00',
              type: 'morning'
            },
            metrics: {
              tasks_completed: staff.tasks_completed || Math.floor(Math.random() * 20) + 10,
              tasks_pending: staff.tasks_pending || Math.floor(Math.random() * 5),
              response_time: Math.floor(Math.random() * 5) + 1,
              satisfaction: Math.floor(Math.random() * 20) + 80,
              attendance: Math.floor(Math.random() * 10) + 90,
              alerts_handled: Math.floor(Math.random() * 15) + 5
            },
            device: {
              id: `DEV-${staff.id ?? 10000 + index}`,
              type: 'mobile',
              battery: Math.floor(Math.random() * 100),
              status: Math.random() > 0.2 ? 'online' : 'offline',
              last_sync: new Date().toISOString()
            },
            skills: ['Primeiros Socorros', 'Comunicação'],
            certifications: ['Segurança Básica']
          }));
        }
      } catch (apiError) {
        console.warn('⚠️ API de staff indisponível, usando dados mock');
      }

      // Se não conseguiu dados da API, usar dados mock
      if (teamMembers.length === 0) {
        teamMembers = generateMockTeam();
      }

      setMembers(teamMembers);
      calculateStats(teamMembers);
      generateGroups(teamMembers);
      
    } catch (error) {
      console.error('❌ Erro ao buscar equipa:', error);
      const mockMembers = generateMockTeam();
      setMembers(mockMembers);
      calculateStats(mockMembers);
      generateGroups(mockMembers);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Gerar dados mock para desenvolvimento
  const generateMockTeam = (): TeamMember[] => {
    const names = [
      'Ana Silva', 'João Santos', 'Maria Oliveira', 'Pedro Costa', 
      'Sofia Ferreira', 'Carlos Rodrigues', 'Inês Pereira', 'Rui Almeida',
      'Catarina Gomes', 'Miguel Carvalho', 'Beatriz Sousa', 'Tiago Fernandes',
      'Mariana Ribeiro', 'André Pinto', 'Joana Correia', 'Hugo Neves',
      'Laura Monteiro', 'Filipe Mendes', 'Rita Nunes', 'Bruno Teixeira'
    ];

    const roles: Array<'Security' | 'Cleaning' | 'Supervisor' | 'Medical' | 'Maintenance' | 'Staff'> = [
      'Security', 'Security', 'Security', 'Security',
      'Cleaning', 'Cleaning', 'Cleaning',
      'Supervisor', 'Supervisor',
      'Medical',
      'Maintenance', 'Maintenance',
      'Staff', 'Staff'
    ];

    const locations = [
      'Setor A - Entrada', 'Setor B - Bancada', 'Setor VIP - Camarotes',
      'Corredor 1', 'Corredor 2', 'Zona Mista', 'Balneários',
      'Sala de Controlo', 'Portão 1', 'Portão 2', 'Estacionamento'
    ];

    const statuses: Array<'active' | 'offline' | 'break' | 'busy' | 'training'> = [
      'active', 'active', 'active', 'active', 'active',
      'break', 'break',
      'busy', 'busy',
      'offline',
      'training'
    ];

    return names.map((name, index) => {
      const role = roles[index % roles.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const battery = Math.floor(Math.random() * 100);
      
      return {
        id: index + 1,
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@fcp.pt`,
        role,
        status,
        location,
        location_details: {
          node_id: `NODE-${index + 1}`,
          area: location.split(' - ')[0],
          coordinates: {
            lat: 41.161758 + (Math.random() * 0.01 - 0.005),
            lng: -8.583933 + (Math.random() * 0.01 - 0.005)
          }
        },
        last_active: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        shift: {
          start: index % 3 === 0 ? '00:00' : index % 3 === 1 ? '08:00' : '16:00',
          end: index % 3 === 0 ? '08:00' : index % 3 === 1 ? '16:00' : '00:00',
          type: index % 3 === 0 ? 'night' : index % 3 === 1 ? 'morning' : 'afternoon'
        },
        metrics: {
          tasks_completed: Math.floor(Math.random() * 50) + 20,
          tasks_pending: Math.floor(Math.random() * 10),
          response_time: Math.floor(Math.random() * 10) + 2,
          satisfaction: Math.floor(Math.random() * 30) + 70,
          attendance: Math.floor(Math.random() * 20) + 80,
          alerts_handled: Math.floor(Math.random() * 30) + 10
        },
        device: {
          id: `DEV-${index + 1000}`,
          type: Math.random() > 0.7 ? 'radio' : 'mobile',
          battery,
          status: battery < 15 ? 'charging' : Math.random() > 0.2 ? 'online' : 'offline',
          last_sync: new Date().toISOString()
        },
        skills: role === 'Security' 
          ? ['Primeiros Socorros', 'Controlo de Multidões', 'Vigilância']
          : role === 'Cleaning'
          ? ['Limpeza Profissional', 'Gestão de Resíduos', 'Produtos Químicos']
          : role === 'Supervisor'
          ? ['Liderança', 'Gestão de Equipas', 'Comunicação']
          : ['Atendimento', 'Apoio'],
        certifications: role === 'Medical' 
          ? ['Suporte Básico de Vida', 'Primeiros Socorros Avançados']
          : ['Formação Inicial'],
        emergency_contact: {
          name: 'Contacto Emergência',
          phone: '912345678',
          relation: 'Familiar'
        }
      };
    });
  };

  // Gerar grupos por role/localização
  const generateGroups = (teamMembers: TeamMember[]) => {
    const groupsByRole: Record<string, TeamGroup> = {};
    
    teamMembers.forEach(member => {
      const roleGroup = member.role;
      
      if (!groupsByRole[roleGroup]) {
        groupsByRole[roleGroup] = {
          id: roleGroup,
          name: getRoleName(roleGroup),
          role: roleGroup,
          members: [],
          location: 'Estádio'
        };
      }
      
      groupsByRole[roleGroup].members.push(member);
    });

    // Atribuir líderes (o membro com mais tarefas concluídas)
    Object.values(groupsByRole).forEach(group => {
      if (group.members.length > 0) {
        group.leader = group.members.reduce((best, current) => 
          current.metrics.tasks_completed > best.metrics.tasks_completed ? current : best
        );
      }
    });

    setGroups(Object.values(groupsByRole));
  };

  // Calcular estatísticas
  const calculateStats = (teamMembers: TeamMember[]) => {
    const newStats: TeamStats = {
      total: teamMembers.length,
      active: 0,
      offline: 0,
      onBreak: 0,
      busy: 0,
      training: 0,
      byRole: {
        Security: 0,
        Cleaning: 0,
        Supervisor: 0,
        Medical: 0,
        Maintenance: 0,
        Staff: 0
      },
      byLocation: {},
      averageResponseTime: 0,
      tasksCompleted: 0,
      tasksPending: 0
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    teamMembers.forEach(member => {
      // Contagem por status
      switch (member.status) {
        case 'active': newStats.active++; break;
        case 'offline': newStats.offline++; break;
        case 'break': newStats.onBreak++; break;
        case 'busy': newStats.busy++; break;
        case 'training': newStats.training++; break;
      }

      // Contagem por role
      if (member.role in newStats.byRole) {
        newStats.byRole[member.role as keyof typeof newStats.byRole]++;
      }

      // Contagem por localização
      const location = member.location.split(' - ')[0];
      newStats.byLocation[location] = (newStats.byLocation[location] || 0) + 1;

      // Métricas
      totalResponseTime += member.metrics.response_time;
      responseTimeCount++;
      newStats.tasksCompleted += member.metrics.tasks_completed;
      newStats.tasksPending += member.metrics.tasks_pending;
    });

    newStats.averageResponseTime = responseTimeCount > 0 
      ? Math.round(totalResponseTime / responseTimeCount) 
      : 0;

    setStats(newStats);
  };

  // Aplicar filtros e pesquisa
  useEffect(() => {
    let filtered = [...members];

    // Pesquisa por nome
    if (searchTerm) {
      filtered = filtered.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por role
    if (filters.roles.length > 0) {
      filtered = filtered.filter(member => filters.roles.includes(member.role));
    }

    // Filtro por status
    if (filters.status.length > 0) {
      filtered = filtered.filter(member => filters.status.includes(member.status));
    }

    // Filtro por localização
    if (filters.locations.length > 0) {
      filtered = filtered.filter(member => 
        filters.locations.some(loc => member.location.includes(loc))
      );
    }

    // Filtro por bateria
    if (filters.minBattery > 0) {
      filtered = filtered.filter(member => member.device.battery >= filters.minBattery);
    }

    // Filtro offline
    if (!filters.showOffline) {
      filtered = filtered.filter(member => member.status !== 'offline');
    }

    // Ordenação
    switch (filters.sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'status':
        filtered.sort((a, b) => {
          const statusOrder = { active: 0, busy: 1, break: 2, training: 3, offline: 4 };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        });
        break;
      case 'location':
        filtered.sort((a, b) => a.location.localeCompare(b.location));
        break;
      case 'tasks':
        filtered.sort((a, b) => b.metrics.tasks_completed - a.metrics.tasks_completed);
        break;
    }

    setFilteredMembers(filtered);
  }, [members, searchTerm, filters]);

  // Carregar dados ao montar
  useEffect(() => {
    fetchTeamMembers();

    const eventSource =
      typeof window !== 'undefined'
        ? new EventSource(EMERGENCY_EVENTS_URL, { withCredentials: true })
        : null;

    const handleRealtimeUpdate = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        console.log('✅ Team SSE update:', parsed.type || 'unknown');
      } catch {
        console.log('✅ Team SSE update received');
      }
      void fetchTeamMembers();
    };

    [
      'incident.created',
      'incident.updated',
      'incident.escalated',
      'incident.resolved',
      'sensor.alert',
      'dispatch.created',
      'dispatch.accepted',
      'dispatch.declined',
      'dispatch.completed',
      'dispatch.arrived',
      'evacuation.created',
      'evacuation.safe',
      'evacuation.completed',
    ].forEach((eventType) => {
      eventSource?.addEventListener(eventType, handleRealtimeUpdate);
    });

    eventSource?.addEventListener('connected', () => {
      console.log('✅ Team SSE connected');
    });

    eventSource?.addEventListener('error', () => {
      console.warn('Team SSE disconnected, browser will retry automatically');
    });

    // Refresh automático a cada 30 segundos
    const interval = setInterval(fetchTeamMembers, 30000);

    return () => {
      eventSource?.close();
      clearInterval(interval);
    };
  }, []);

  // Obter nome em português da role
  const getRoleName = (role: string): string => {
    const roleMap: Record<string, string> = {
      Security: 'Segurança',
      Cleaning: 'Limpeza',
      Supervisor: 'Supervisor',
      Medical: 'Equipa Médica',
      Maintenance: 'Manutenção',
      Staff: 'Staff Geral'
    };
    return roleMap[role] || role;
  };

  // Obter cor da role
  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'Security': return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'Cleaning': return 'text-green-600 bg-green-100 border-green-200';
      case 'Supervisor': return 'text-purple-600 bg-purple-100 border-purple-200';
      case 'Medical': return 'text-red-600 bg-red-100 border-red-200';
      case 'Maintenance': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  // Obter ícone da role
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Security': return Shield;
      case 'Cleaning': return Brush;
      case 'Supervisor': return UserCog;
      case 'Medical': return AlertCircle;
      case 'Maintenance': return Zap;
      default: return User;
    }
  };

  // Obter cor do status
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      case 'break': return 'text-yellow-600 bg-yellow-100';
      case 'busy': return 'text-red-600 bg-red-100';
      case 'training': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Obter texto do status
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'offline': return 'Offline';
      case 'break': return 'Pausa';
      case 'busy': return 'Ocupado';
      case 'training': return 'Formação';
      default: return status;
    }
  };

  // Obter ícone da bateria
  const getBatteryIcon = (battery: number) => {
    if (battery > 80) return BatteryCharging;
    if (battery > 20) return Battery;
    return BatteryWarning;
  };

  // Obter cor da bateria
  const getBatteryColor = (battery: number): string => {
    if (battery > 80) return 'text-green-600';
    if (battery > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Formatar tempo
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar equipa...</p>
          </div>
        </div>
    );
  }

  return (
    <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Equipa</h1>
            <p className="text-gray-600 mt-1">
              {stats.active} ativos • {stats.onBreak} em pausa • {stats.offline} offline
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {viewMode === 'grid' ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Filter size={18} />
              Filtros
            </button>

            <button
              onClick={() => setShowGroups(!showGroups)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <Users size={18} />
              Grupos
            </button>

            <button
              onClick={fetchTeamMembers}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Pesquisar por nome, email ou função..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
            />
          </div>
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Filtros</h2>
              <button
                onClick={() => setFilters({
                  roles: [],
                  status: [],
                  locations: [],
                  showOffline: true,
                  minBattery: 0,
                  sortBy: 'name'
                })}
                className="text-sm text-[#4F46E5] hover:text-[#4338CA]"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {/* Filtro por Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Função
                </label>
                <div className="space-y-2">
                  {['Security', 'Cleaning', 'Supervisor', 'Medical', 'Maintenance', 'Staff'].map((role) => (
                    <label key={role} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.roles.includes(role)}
                        onChange={() => {
                          setFilters(prev => ({
                            ...prev,
                            roles: prev.roles.includes(role)
                              ? prev.roles.filter(r => r !== role)
                              : [...prev.roles, role]
                          }));
                        }}
                        className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                      />
                      <span className="text-sm text-gray-700">{getRoleName(role)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtro por Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <div className="space-y-2">
                  {['active', 'busy', 'break', 'training', 'offline'].map((status) => (
                    <label key={status} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => {
                          setFilters(prev => ({
                            ...prev,
                            status: prev.status.includes(status)
                              ? prev.status.filter(s => s !== status)
                              : [...prev.status, status]
                          }));
                        }}
                        className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                      />
                      <span className="text-sm text-gray-700">{getStatusText(status)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filtro por Localização */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Localização
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.keys(stats.byLocation).map((location) => (
                    <label key={location} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.locations.includes(location)}
                        onChange={() => {
                          setFilters(prev => ({
                            ...prev,
                            locations: prev.locations.includes(location)
                              ? prev.locations.filter(l => l !== location)
                              : [...prev.locations, location]
                          }));
                        }}
                        className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                      />
                      <span className="text-sm text-gray-700">{location} ({stats.byLocation[location]})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Outros Filtros */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bateria mínima
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.minBattery}
                  onChange={(e) => setFilters(prev => ({ ...prev, minBattery: parseInt(e.target.value) }))}
                  className="w-full mb-2"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>0%</span>
                  <span>{filters.minBattery}%</span>
                  <span>100%</span>
                </div>

                <label className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    checked={filters.showOffline}
                    onChange={(e) => setFilters(prev => ({ ...prev, showOffline: e.target.checked }))}
                    className="rounded border-gray-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                  />
                  <span className="text-sm text-gray-700">Mostrar offline</span>
                </label>

                <label className="block text-sm font-medium text-gray-700 mt-4 mb-2">
                  Ordenar por
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => {
                    const value = e.target.value as 'name' | 'status' | 'location' | 'tasks';
                    setFilters(prev => ({ ...prev, sortBy: value }));
                  }}
                  className="w-full rounded-lg border-gray-300 text-gray-700"
                >
                  <option value="name">Nome</option>
                  <option value="status">Estado</option>
                  <option value="location">Localização</option>
                  <option value="tasks">Tarefas</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Grupos */}
        {showGroups && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Grupos por Função</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {groups.map((group) => {
                const GroupIcon = getRoleIcon(group.role);
                const roleColor = getRoleColor(group.role).split(' ')[0];
                
                return (
                  <div
                    key={group.id}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getRoleColor(group.role)}`}>
                          <GroupIcon size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{group.name}</h3>
                          <p className="text-sm text-gray-600">{group.members.length} membros</p>
                        </div>
                      </div>
                      {expandedGroup === group.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>

                    {expandedGroup === group.id && group.leader && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-700 mb-2">Líder:</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-sm">
                            {group.leader.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{group.leader.name}</p>
                            <p className="text-xs text-gray-600">
                              {group.leader.metrics.tasks_completed} tarefas
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lista de Membros */}
        {filteredMembers.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sem membros</h3>
            <p className="text-gray-600">
              Não há membros da equipa para mostrar com os filtros atuais.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          // Visualização em Grid
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredMembers.map((member) => {
              const RoleIcon = getRoleIcon(member.role);
              const BatteryIcon = getBatteryIcon(member.device.battery);
              
              return (
                <div
                  key={member.id}
                  className="cursor-pointer rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-lg font-medium">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{member.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(member.role)}`}>
                              {getRoleName(member.role)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(member.status)}`}>
                        {getStatusText(member.status)}
                      </span>
                    </div>

                    {/* Localização */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <MapPin size={14} />
                      <span>{member.location}</span>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">Tarefas</p>
                        <p className="font-semibold text-gray-900">{member.metrics.tasks_completed}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">Resposta</p>
                        <p className="font-semibold text-gray-900">{member.metrics.response_time}min</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">Satisfação</p>
                        <p className="font-semibold text-gray-900">{member.metrics.satisfaction}%</p>
                      </div>
                    </div>

                    {/* Dispositivo */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {member.device.status === 'online' ? (
                          <Wifi size={14} className="text-green-600" />
                        ) : (
                          <WifiOff size={14} className="text-gray-400" />
                        )}
                        <span className="text-gray-600">{member.device.id}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BatteryIcon size={14} className={getBatteryColor(member.device.battery)} />
                        <span className={`text-xs ${getBatteryColor(member.device.battery)}`}>
                          {member.device.battery}%
                        </span>
                      </div>
                    </div>

                    {/* Último ativo */}
                    <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>Último ativo: {formatTime(member.last_active)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Visualização em Lista
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Membro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Função
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Localização
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dispositivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarefas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMembers.map((member) => {
                  const RoleIcon = getRoleIcon(member.role);
                  const BatteryIcon = getBatteryIcon(member.device.battery);
                  
                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedMember(member)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-sm font-medium mr-3">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{member.name}</div>
                            <div className="text-xs text-gray-500">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(member.role)}`}>
                          {getRoleName(member.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(member.status)}`}>
                          {getStatusText(member.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {member.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {member.device.status === 'online' ? (
                            <Wifi size={14} className="text-green-600" />
                          ) : (
                            <WifiOff size={14} className="text-gray-400" />
                          )}
                          <BatteryIcon size={14} className={getBatteryColor(member.device.battery)} />
                          <span className={`text-xs ${getBatteryColor(member.device.battery)}`}>
                            {member.device.battery}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {member.metrics.tasks_completed} / {member.metrics.tasks_pending}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-[#4F46E5] hover:text-[#4338CA]">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de Detalhes do Membro */}
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10">
              <div className="p-6">
                {/* Header do Modal */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-2xl font-medium">
                      {selectedMember.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedMember.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${getRoleColor(selectedMember.role)}`}>
                          {getRoleName(selectedMember.role)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(selectedMember.status)}`}>
                          {getStatusText(selectedMember.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <XCircle size={24} className="text-gray-500" />
                  </button>
                </div>

                {/* Informações de Contacto */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Mail size={16} />
                      <span className="text-sm">Email</span>
                    </div>
                    <p className="text-gray-900 font-medium">{selectedMember.email}</p>
                  </div>
                  {selectedMember.emergency_contact && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <Phone size={16} />
                        <span className="text-sm">Contacto Emergência</span>
                      </div>
                      <p className="text-gray-900 font-medium">{selectedMember.emergency_contact.phone}</p>
                      <p className="text-xs text-gray-600">{selectedMember.emergency_contact.name} ({selectedMember.emergency_contact.relation})</p>
                    </div>
                  )}
                </div>

                {/* Localização Atual */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Localização Atual</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={16} className="text-[#4F46E5]" />
                      <span className="text-gray-900 font-medium">{selectedMember.location}</span>
                    </div>
                    {selectedMember.location_details?.coordinates && (
                      <p className="text-xs text-gray-600">
                        Coordenadas: {selectedMember.location_details.coordinates.lat.toFixed(6)}, {selectedMember.location_details.coordinates.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Turno */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Turno Atual</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-600 mb-1">Início</p>
                      <p className="text-gray-900 font-medium">{selectedMember.shift.start}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-600 mb-1">Fim</p>
                      <p className="text-gray-900 font-medium">{selectedMember.shift.end}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-600 mb-1">Tipo</p>
                      <p className="text-gray-900 font-medium capitalize">{selectedMember.shift.type}</p>
                    </div>
                  </div>
                </div>

                {/* Métricas de Performance */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Performance</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 mb-1">Tarefas</p>
                      <p className="text-lg font-bold text-blue-700">{selectedMember.metrics.tasks_completed}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600 mb-1">Tempo Resposta</p>
                      <p className="text-lg font-bold text-green-700">{selectedMember.metrics.response_time}min</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs text-yellow-600 mb-1">Satisfação</p>
                      <p className="text-lg font-bold text-yellow-700">{selectedMember.metrics.satisfaction}%</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-purple-600 mb-1">Assiduidade</p>
                      <p className="text-lg font-bold text-purple-700">{selectedMember.metrics.attendance}%</p>
                    </div>
                  </div>
                </div>

                {/* Skills e Certificações */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Competências</h3>
                    <div className="space-y-2">
                      {selectedMember.skills.map((skill, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Star size={14} className="text-yellow-500" />
                          <span className="text-sm text-gray-700">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Certificações</h3>
                    <div className="space-y-2">
                      {selectedMember.certifications.map((cert, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-green-500" />
                          <span className="text-sm text-gray-700">{cert}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dispositivo */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Dispositivo</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {selectedMember.device.type === 'radio' ? (
                          <Radio size={16} className="text-[#4F46E5]" />
                        ) : selectedMember.device.type === 'tablet' ? (
                          <Camera size={16} className="text-[#4F46E5]" />
                        ) : (
                          <Phone size={16} className="text-[#4F46E5]" />
                        )}
                        <span className="text-gray-900 font-medium">{selectedMember.device.id}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        selectedMember.device.status === 'online' ? 'bg-green-100 text-green-600' :
                        selectedMember.device.status === 'charging' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedMember.device.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BatteryIcon size={16} className={getBatteryColor(selectedMember.device.battery)} />
                      <div className="flex-1 h-2 bg-gray-200 rounded-full">
                        <div
                          className={`h-2 rounded-full ${
                            selectedMember.device.battery > 80 ? 'bg-green-600' :
                            selectedMember.device.battery > 20 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${selectedMember.device.battery}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-medium ${getBatteryColor(selectedMember.device.battery)}`}>
                        {selectedMember.device.battery}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Última sincronização: {formatTime(selectedMember.device.last_sync)}
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleSendMessage(selectedMember)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA]"
                  >
                    <MessageSquare size={18} />
                    Enviar Mensagem
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLocateMember(selectedMember)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <Navigation size={18} />
                    Localizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {locatingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Localização da equipa</p>
                  <h3 className="mt-1 text-xl font-black text-gray-900">{locatingMember.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {getRoleName(locatingMember.role)} · localização {locatingMember.location}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-700">
                    Piso {getMemberFloor(locatingMember)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocatingMember(null)}
                    className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>

              <div className="p-5">
                <IndoorGisMap
                  floorId={getMemberFloor(locatingMember)}
                  heightClassName="h-[62vh] min-h-[32rem]"
                  showHeatmap={false}
                  showCameraControls={false}
                  showStaffMarkers
                  staffFilterId={locatingMember.id}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                  <span className="font-bold">A mostrar apenas:</span> {locatingMember.name} · Piso {getMemberFloor(locatingMember)}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLocatingMember(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleNavigateToMember(locatingMember)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Abrir rota no mapa
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
