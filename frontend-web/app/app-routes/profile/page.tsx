'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useLangStore } from '@/lib/stores/useLangStore';
import {
  User,
  Shield,
  Brush,
  UserCog,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  Star,
  Award,
  Target,
  MapPin,
  Phone,
  Mail,
  LogOut,
  Globe,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { RouteWaypoint, useNavigationStore } from '@/lib/stores/useNavigationStore';
import { AUTH_SERVICE, EMERGENCY_EVENTS_URL, EMERGENCY_SERVICE, MAINTENANCE_SERVICE, api } from '@/lib/services/api';

type Role = 'Security' | 'Cleaning' | 'Supervisor' | 'Medical' | string;

interface StaffApiItem {
  id: number;
  name: string;
  role: string;
  location: string;
}

interface EmergencyStats {
  total_incidents: number;
  active_incidents: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  avg_response_time_min: number | null;
  avg_resolution_time_min: number | null;
  false_alarms: number;
  external_alerts_sent: number;
}

interface TimelineEntry {
  incident_id: string;
  incident_type: string;
  severity: string;
  status: string;
  timestamp: string;
  location: string;
}

interface MaintenanceStaffStats {
  staff_id: string;
  tasks_completed: number;
  tasks_in_progress: number;
  avg_completion_time_min: number | null;
  total_distance_m: number;
}

interface ProfileStats {
  incidentsHandled: number;
  successRate: number;
  avgResponseTime: string;
  totalHours: number;
  rating: number;
  badges: Array<{ id: string; name: string; icon: string }>;
}

interface RecentActivity {
  id: string;
  type: 'incident' | 'task' | 'achievement';
  title: string;
  time: string;
  status: 'completed' | 'pending' | 'in-progress';
}

interface PendingDispatch {
  id: string;
  incident_id: string;
  responder_id: string;
  route_nodes?: string[];
  eta_seconds?: number;
  incident_type?: string;
  incident_location?: string;
  incident_severity?: string;
}

interface IncidentSummary {
  id: string;
  incident_type?: string;
  location_node?: string;
  severity?: string;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

function roleIcon(role: Role) {
  if (role === 'Security') return Shield;
  if (role === 'Cleaning') return Brush;
  if (role === 'Supervisor') return UserCog;
  if (role === 'Medical') return AlertTriangle;
  return User;
}

function roleBadgeVariant(role: Role): 'primary' | 'success' | 'warning' | 'default' {
  if (role === 'Security') return 'primary';
  if (role === 'Cleaning') return 'success';
  if (role === 'Supervisor') return 'warning';
  return 'default';
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { lang: language, setLang } = useLangStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [onDuty, setOnDuty] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>(() =>
    (localStorage.getItem('font-size') as 'sm' | 'md' | 'lg') || 'md'
  );
  const [contrast, setContrast] = useState<number>(() =>
    Number(localStorage.getItem('contrast') || '100')
  );

  const [profileName, setProfileName] = useState('');
  const [profileLocation, setProfileLocation] = useState('Sem localização');
  const [profilePhone] = useState('Sem telefone');

  const [profileStats, setProfileStats] = useState<ProfileStats>({
    incidentsHandled: 0,
    successRate: 0,
    avgResponseTime: '0 min',
    totalHours: 0,
    rating: 0,
    badges: [],
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [pendingDispatches, setPendingDispatches] = useState<PendingDispatch[]>([]);
  const [dispatchActionLoading, setDispatchActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const sizeMap = { sm: '14px', md: '16px', lg: '19px' };
    document.documentElement.style.fontSize = sizeMap[fontSize];
    localStorage.setItem('font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.style.filter = contrast !== 100 ? `contrast(${contrast}%)` : '';
    localStorage.setItem('contrast', String(contrast));
  }, [contrast]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      setLoading(true);
      setError('');

      const requestConfig = { withCredentials: true, timeout: 6000 };

      try {
        const [staffRes, emergencyStatsRes, timelineRes, maintenanceStatsRes] = await Promise.allSettled([
          axios.get<StaffApiItem[]>(`${AUTH_SERVICE}/staff`, requestConfig),
          axios.get<EmergencyStats>(`${EMERGENCY_SERVICE}/stats`, requestConfig),
          axios.get<TimelineEntry[]>(`${EMERGENCY_SERVICE}/stats/timeline`, {
            params: { hours: 24 },
            ...requestConfig,
          }),
          axios.get<MaintenanceStaffStats>(`${MAINTENANCE_SERVICE}/stats/staff/${user.id ?? ''}`, {
            ...requestConfig,
          }),
        ]);

        let staffItem: StaffApiItem | undefined;
        if (staffRes.status === 'fulfilled') {
          staffItem = staffRes.value.data.find((s) => s.id === user.id);
          setProfileName(staffItem?.name || user.email.split('@')[0]);
          setProfileLocation(staffItem?.location || 'Sem localização');
        } else {
          setProfileName(user.email.split('@')[0]);
        }

        const emergencyStats =
          emergencyStatsRes.status === 'fulfilled'
            ? emergencyStatsRes.value.data
            : {
                total_incidents: 0,
                active_incidents: 0,
                by_type: {},
                by_severity: {},
                by_status: {},
                avg_response_time_min: null,
                avg_resolution_time_min: null,
                false_alarms: 0,
                external_alerts_sent: 0,
              };

        const maintenanceStats =
          maintenanceStatsRes.status === 'fulfilled'
            ? maintenanceStatsRes.value.data
            : {
                staff_id: String(user.id ?? ''),
                tasks_completed: 0,
                tasks_in_progress: 0,
                avg_completion_time_min: null,
                total_distance_m: 0,
              };

        const incidentsHandled =
          (emergencyStats.by_status?.resolved || 0) +
          (emergencyStats.by_status?.contained || 0) +
          maintenanceStats.tasks_completed;

        const totalTracked = emergencyStats.total_incidents + maintenanceStats.tasks_completed;
        const unresolved =
          (emergencyStats.by_status?.active || 0) +
          (emergencyStats.by_status?.investigating || 0) +
          (emergencyStats.by_status?.responding || 0);
        const successRate = totalTracked > 0 ? Math.max(0, Math.round(((totalTracked - unresolved) / totalTracked) * 100)) : 0;

        const avgResponseParts = [
          emergencyStats.avg_response_time_min,
          maintenanceStats.avg_completion_time_min,
        ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        const avgResponseValue =
          avgResponseParts.length > 0
            ? Math.round((avgResponseParts.reduce((a, b) => a + b, 0) / avgResponseParts.length) * 10) / 10
            : 0;

        const roleWeight = user.role === 'Supervisor' ? 0.4 : user.role === 'Security' ? 0.5 : 0.3;
        const ratingBase = 3.5 + Math.min(1.5, successRate / 100 + roleWeight * 0.2);
        const rating = Math.round(ratingBase * 10) / 10;

        const totalHours = Math.round((maintenanceStats.total_distance_m || 0) / 450) + maintenanceStats.tasks_completed;

        const badges: Array<{ id: string; name: string; icon: string }> = [];
        if (maintenanceStats.tasks_completed >= 10) badges.push({ id: 'tasks-10', name: '10 tarefas concluídas', icon: '✅' });
        if ((emergencyStats.by_severity?.critical || 0) > 0) badges.push({ id: 'critical', name: 'Resposta crítica', icon: '🚨' });
        if (successRate >= 90) badges.push({ id: 'consistency', name: 'Consistência 90%+', icon: '🏅' });

        setProfileStats({
          incidentsHandled,
          successRate,
          avgResponseTime: `${avgResponseValue} min`,
          totalHours,
          rating,
          badges,
        });

        const timeline = timelineRes.status === 'fulfilled' ? timelineRes.value.data : [];
        const activities: RecentActivity[] = timeline.slice(0, 8).map((item) => ({
          id: item.incident_id,
          type: 'incident',
          title: `${item.incident_type.toUpperCase()} - ${item.location}`,
          time: relativeTime(item.timestamp),
          status:
            item.status === 'resolved' || item.status === 'contained'
              ? 'completed'
              : item.status === 'active' || item.status === 'responding'
              ? 'in-progress'
              : 'pending',
        }));

        if (maintenanceStats.tasks_in_progress > 0) {
          activities.unshift({
            id: 'maintenance-progress',
            type: 'task',
            title: `${maintenanceStats.tasks_in_progress} tarefa(s) de manutenção em progresso`,
            time: 'agora',
            status: 'in-progress',
          });
        }

        setRecentActivity(activities);

        // Fetch pending dispatches for this user
        if (user.role !== 'Supervisor') {
          try {
            const [dispatchRes, incidentRes] = await Promise.all([
              axios.get(`${EMERGENCY_SERVICE}/dispatch/active`, {
                withCredentials: true,
                timeout: 5000,
              }),
              axios.get(`${EMERGENCY_SERVICE}/incidents`, {
                withCredentials: true,
                timeout: 5000,
              }),
            ]);
            const allDispatches: PendingDispatch[] = dispatchRes.data ?? [];
            const allIncidents: IncidentSummary[] = incidentRes.data?.incidents ?? incidentRes.data ?? [];
            const myId = String(user.id);
            const mine = allDispatches.filter(
              d => d.responder_id === myId ||
                   d.responder_id === `STAFF_${user.role?.toUpperCase()}_${myId.padStart(3,'0')}`
            ).map(d => {
              const inc = allIncidents.find(i => i.id === d.incident_id);
              return { ...d, incident_type: inc?.incident_type, incident_location: inc?.location_node, incident_severity: inc?.severity };
            });
            setPendingDispatches(mine);
          } catch { /* non-critical */ }
        }

        if (
          staffRes.status === 'rejected' &&
          emergencyStatsRes.status === 'rejected' &&
          timelineRes.status === 'rejected' &&
          maintenanceStatsRes.status === 'rejected'
        ) {
          setError('Não foi possível carregar dados do perfil a partir dos serviços.');
        }
      } catch {
        setError('Erro ao carregar dados do perfil.');
      } finally {
        setLoading(false);
      }
    };

    void run();

    const eventSource =
      typeof window !== 'undefined'
        ? new EventSource(EMERGENCY_EVENTS_URL, { withCredentials: true })
        : null;

    const handleRealtimeUpdate = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        console.debug('[Profile SSE] Received update:', parsed.type || 'unknown');
      } catch {
        console.debug('[Profile SSE] Received update');
      }
      void run();
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
      console.info('[Profile SSE] Connected');
    });

    eventSource?.addEventListener('error', () => {
      console.warn('[Profile SSE] Disconnected; the browser will retry automatically');
    });

    return () => {
      eventSource?.close();
    };
  }, [user]);

  const handleLanguageChange = (lang: 'pt' | 'en') => {
    setLang(lang);
  };

  const { setNavigation } = useNavigationStore();

  const handleNavigateDispatch = async (d: PendingDispatch) => {
      setDispatchActionLoading(`nav-${d.id}`);
      try {
        const fromNode = '62';
      const routeNodes = d.route_nodes ?? [];
      const waypoints: RouteWaypoint[] = routeNodes.length >= 2
        ? routeNodes.map((n: string) => ({ node_id: n, x: 0, y: 0 }))
        : (await api.getRoute(fromNode, d.incident_location ?? '62').catch(() => ({ waypoints: [] }))).waypoints;
      setNavigation({
        taskId: d.id, binId: d.incident_id,
        binName: `${(d.incident_type ?? 'incident').toUpperCase()} — ${d.incident_location}`,
        targetNode: d.incident_location ?? '62', fromNode,
        waypoints, etaSeconds: d.eta_seconds ?? 0,
      });
      router.push('/app-routes/map');
    } catch { alert('Não foi possível calcular a rota.'); }
    finally { setDispatchActionLoading(null); }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth-routes/login');
  };

  const handleExport = () => {
    const payload = {
      user: {
        id: user?.id,
        email: user?.email,
        role: user?.role,
        name: profileName,
        location: profileLocation,
      },
      stats: profileStats,
      recentActivity,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perfil-${user?.id ?? 'user'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const RoleIcon = roleIcon(user?.role || '');

  const statusBadge = useMemo(() => (onDuty ? 'Em Serviço' : 'Fora de Serviço'), [onDuty]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5] mx-auto mb-4" />
          <p className="text-gray-600">A carregar perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] pb-20">
      <div className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] h-32 relative">
        <div className="absolute -bottom-12 left-6">
          <Avatar
            name={profileName || user.email.split('@')[0]}
            role={user.role}
            size="xl"
            status={onDuty ? 'online' : 'offline'}
            className="border-4 border-white shadow-lg"
          />
        </div>
      </div>

      <div className="px-6 pt-16">
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        {/* Pending dispatches banner */}
        {pendingDispatches.length > 0 && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-blue-500" />
                <span className="font-semibold text-blue-700 text-sm">
                  {pendingDispatches.length} tarefa{pendingDispatches.length > 1 ? 's' : ''} atribuída{pendingDispatches.length > 1 ? 's' : ''} a ti
                </span>
              </div>
              <button
                onClick={() => router.push(user.role === 'Medical' ? '/app-routes/medical/incidents' : '/app-routes/tasks')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Ver no separador {user.role === 'Medical' ? 'Incidentes Médicos' : 'Tarefas'} →
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">{profileName || user.email.split('@')[0]}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={roleBadgeVariant(user.role)}>
                  <RoleIcon size={12} className="mr-1" />
                  {user.role}
                </Badge>
                <Badge variant={onDuty ? 'success' : 'default'} size="sm">
                  {statusBadge}
                </Badge>
              </div>
            </div>
            {loading ? <span className="text-xs text-gray-500">A atualizar...</span> : null}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Mail size={16} />
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Phone size={16} />
              <span className="text-sm">{profilePhone}</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B7280]">
              <MapPin size={16} />
              <span className="text-sm">{profileLocation}</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B7280]">
              <Calendar size={16} />
              <span className="text-sm">ID de staff: {user.id ?? 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target size={16} className="text-blue-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Incidentes/Tarefas</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">{profileStats.incidentsHandled}</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle size={16} className="text-green-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Sucesso</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">{profileStats.successRate}%</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock size={16} className="text-yellow-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Tempo Médio</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">{profileStats.avgResponseTime}</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star size={16} className="text-purple-600" />
              </div>
              <span className="text-xs text-[#6B7280]">Avaliação</span>
            </div>
            <span className="text-xl font-bold text-[#1F2937]">{profileStats.rating}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">CONQUISTAS</h3>
          <div className="flex flex-wrap gap-2">
            {profileStats.badges.length === 0 ? (
              <span className="text-sm text-gray-500">Sem conquistas calculadas ainda.</span>
            ) : (
              profileStats.badges.map((badge) => (
                <div key={badge.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-xl">{badge.icon}</span>
                  <span className="text-sm font-medium text-[#1F2937]">{badge.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">ATIVIDADE RECENTE</h3>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-500">Sem atividade recente.</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      activity.type === 'incident' ? 'bg-red-100' : activity.type === 'task' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}
                  >
                    {activity.type === 'incident' && <AlertTriangle size={16} className="text-red-600" />}
                    {activity.type === 'task' && <CheckCircle size={16} className="text-green-600" />}
                    {activity.type === 'achievement' && <Award size={16} className="text-yellow-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1F2937]">{activity.title}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{activity.time}</p>
                  </div>
                  {activity.status === 'completed' && <Badge variant="success" size="sm">Concluído</Badge>}
                  {activity.status === 'in-progress' && <Badge variant="warning" size="sm">Em andamento</Badge>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h3 className="text-sm font-bold text-[#6B7280] tracking-wider mb-4">PREFERÊNCIAS</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-[#6B7280]" />
                <span className="text-sm text-[#1F2937]">Idioma</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLanguageChange('pt')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    language === 'pt' ? 'bg-[#4F46E5] text-white' : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                  }`}
                >
                  PT
                </button>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    language === 'en' ? 'bg-[#4F46E5] text-white' : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <Switch
              label="Notificações Push"
              description="Receber alertas em tempo real"
              checked={pushEnabled}
              onChange={setPushEnabled}
            />

            <Switch
              label="Som de Alertas"
              description="Reproduzir som quando chegar alerta"
              checked={soundEnabled}
              onChange={setSoundEnabled}
            />

            <Switch
              label="Vibração"
              description="Vibrar em situações de emergência"
              checked={vibrationEnabled}
              onChange={setVibrationEnabled}
            />

            <Switch
              label="Em Serviço"
              description="Mostrar como disponível para tarefas"
              checked={onDuty}
              onChange={setOnDuty}
            />

            {/* Font size */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[#6B7280]" style={{ fontSize: 20 }}>A</span>
                <span className="text-sm text-[#1F2937]">Tamanho de letra</span>
              </div>
              <div className="flex gap-2">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFontSize(s)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      fontSize === s ? 'bg-[#4F46E5] text-white' : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                    }`}
                  >
                    {s === 'sm' ? 'A' : s === 'md' ? 'A+' : 'A++'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[#6B7280]">◑</span>
                  <span className="text-sm text-[#1F2937]">Contraste</span>
                </div>
                <span className="text-sm font-medium text-[#4F46E5]">{contrast}%</span>
              </div>
              <input
                type="range"
                min={80}
                max={150}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-[#4F46E5]"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Baixo</span>
                <button onClick={() => setContrast(100)} className="text-[#4F46E5] hover:underline">Repor</button>
                <span>Alto</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-[#1F2937] font-medium hover:bg-gray-50 transition-colors"
          >
            <Download size={20} />
            Exportar Dados
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium hover:bg-red-100 transition-colors"
          >
            <LogOut size={20} />
            Terminar Sessão
          </button>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">OpsLite v1.0.2 • {user.role}</p>
      </div>
    </div>
  );
}
