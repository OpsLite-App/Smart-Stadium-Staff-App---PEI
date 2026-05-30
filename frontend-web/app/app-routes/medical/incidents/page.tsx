'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { RouteWaypoint, useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api, EMERGENCY_EVENTS_URL, EMERGENCY_SERVICE, MAINTENANCE_SERVICE } from '@/lib/services/api';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import { indoorRoutingService, type IndoorRouteGeoJsonResponse } from '@/lib/services/indoorRouting';
import axios from 'axios';
import { 
  Heart, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Navigation,
  Phone,
  MessageCircle,
  User,
  Calendar,
  Activity,
  Droplets,
  Flame,
  Shield,
  ChevronRight,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  Flag,
  Target,
  Compass,
  Stethoscope,
  Ambulance,
  HeartPulse
} from 'lucide-react';

interface MedicalIncident {
  id: string;
  incident_type: string;
  location_node: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  description?: string;
  created_at: string;
  detected_by?: string;
  reported_by?: string;
  responders_dispatched?: number;
  assigned_to?: string;
  assigned_at?: string;
}

interface MyDispatch {
  id: string;
  incident_id: string;
  responder_id: string;
  responder_role: string;
  status: 'dispatched' | 'en_route' | 'arrived' | 'completed' | 'declined' | 'false_alarm';
  eta_seconds?: number;
  route_nodes?: string[];
  dispatched_at: string;
  arrived_at?: string;
  completed_at?: string;
}

// ✅ Interface para a resposta do backend com localização do staff
interface StaffLocation {
  id: string;
  name: string;
  role: string;
  current_location: string;
  is_available: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={20} className="text-red-500" />,
  high: <AlertTriangle size={20} className="text-orange-500" />,
  medium: <Activity size={20} className="text-yellow-500" />,
  low: <HeartPulse size={20} className="text-blue-500" />,
};

const STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  dispatched: { label: 'Despachado', color: 'bg-blue-100 text-blue-700', icon: <Clock size={14} /> },
  en_route: { label: 'A caminho', color: 'bg-yellow-100 text-yellow-700', icon: <Navigation size={14} /> },
  arrived: { label: 'Chegou', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={14} /> },
  completed: { label: 'Concluído', color: 'bg-gray-100 text-gray-700', icon: <Flag size={14} /> },
  declined: { label: 'Recusado', color: 'bg-red-100 text-red-700', icon: <XCircle size={14} /> },
  false_alarm: { label: 'Falso alarme', color: 'bg-slate-100 text-slate-700', icon: <XCircle size={14} /> },
};

function getDispatchGuidance(status?: MyDispatch['status']) {
  switch (status) {
    case 'dispatched':
      return {
        title: 'Incidente atribuído',
        description: 'Aceita o pedido para assumir o atendimento. A rota até ao local será iniciada automaticamente.',
        className: 'border-blue-100 bg-blue-50 text-blue-800',
      };
    case 'en_route':
      return {
        title: 'A caminho do local',
        description: 'Quando chegares ao nó do incidente, marca chegada para poderes concluir o atendimento.',
        className: 'border-amber-100 bg-amber-50 text-amber-800',
      };
    case 'arrived':
      return {
        title: 'Pronto para concluir',
        description: 'Depois de prestares assistência, carrega em Concluir Atendimento e escreve um pequeno relatório do que foi feito.',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-800',
      };
    case 'false_alarm':
      return {
        title: 'Falso alarme',
        description: 'O supervisor cancelou este incidente. Não é necessária intervenção.',
        className: 'border-slate-200 bg-slate-50 text-slate-700',
      };
    default:
      return null;
  }
}

export default function MedicalIncidentsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { setNavigation, clearNavigation, active: activeNav } = useNavigationStore();
  
  const [incidents, setIncidents] = useState<MedicalIncident[]>([]);
  const [myDispatches, setMyDispatches] = useState<MyDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<MedicalIncident | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; eta_seconds: number; waypoints: RouteWaypoint[] } | null>(null);
  const [routeModalIncident, setRouteModalIncident] = useState<MedicalIncident | null>(null);
  const [routeModalGeoJson, setRouteModalGeoJson] = useState<IndoorRouteGeoJsonResponse | null>(null);
  const [routeModalFloor, setRouteModalFloor] = useState<'0' | '1' | '2'>('1');
  const [routeModalLoading, setRouteModalLoading] = useState(false);
  const [routeModalError, setRouteModalError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string>('1'); // Estado para localização atual no grafo pgRouting

  // ✅ Função para buscar a localização atual do médico
  const fetchCurrentLocation = useCallback(async () => {
    if (!user?.id) return '1';
    
    try {
      // Tentar buscar do Maintenance Service (staff coordinator)
      const response = await axios.get<StaffLocation[]>(`${MAINTENANCE_SERVICE}/staff`, {
        timeout: 3000,
      });
      
      const staffMember = response.data.find(s => s.id === String(user.id));
      if (staffMember?.current_location) {
        setCurrentLocation(staffMember.current_location);
        return staffMember.current_location;
      }
    } catch (error) {
      console.log('Maintenance Service não disponível, tentando Auth Service...');
    }
    
    try {
      // Fallback: usar a lista autenticada do Auth Service.
      const response = await axios.get<Array<{ id: number | string; location?: string; current_location?: string }>>(`/api/auth/staff`, {
        timeout: 3000,
        withCredentials: true,
      });
      
      const staffMember = response.data.find((member) => String(member.id) === String(user.id));
      const location = staffMember?.current_location || staffMember?.location;
      if (location) {
        setCurrentLocation(location);
        return location;
      }
    } catch (error) {
      console.log('Auth Service não disponível, usando localização padrão');
    }
    
    return '1';
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      // ✅ Buscar localização atual do médico
      await fetchCurrentLocation();
      
      // Buscar incidentes médicos operacionais. Depois da atribuição, o backend
      // pode mudar o estado para "responding", por isso não podemos pedir só
      // status=active ou o incidente desaparece da vista do médico.
      const incidentsRes = await axios.get(`${EMERGENCY_SERVICE}/incidents`, {
        params: { incident_type: 'medic' },
        timeout: 5000,
      });
      
      // Buscar meus despachos ativos
      const dispatchesRes = await axios.get(`${EMERGENCY_SERVICE}/dispatch/active`, {
        timeout: 5000,
      });
      
      // Filtrar despachos do médico atual. Alguns dispatches automáticos usam
      // o formato STAFF_MEDICAL_001; os manuais usam o id real do utilizador.
      const myId = String(user.id);
      const syntheticMedicalId = `STAFF_MEDICAL_${myId.padStart(3, '0')}`;
      const myActiveDispatches = ((dispatchesRes.data || []) as MyDispatch[]).filter(
        (d) =>
          (d.responder_id === myId || d.responder_id === syntheticMedicalId) &&
          !['completed', 'declined'].includes(d.status)
      );

      const myIncidentIds = new Set(myActiveDispatches.map((dispatch) => dispatch.incident_id));
      const visibleIncidents = ((incidentsRes.data?.incidents || []) as MedicalIncident[]).filter((incident) => {
        const status = String(incident.status || '').toLowerCase();
        if (status === 'resolved') return false;
        if (status === 'false_alarm') return myIncidentIds.has(incident.id);
        return true;
      });

      setIncidents(visibleIncidents);
      setMyDispatches(myActiveDispatches);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, fetchCurrentLocation]);

  useEffect(() => {
    fetchData();
    const eventSource =
      typeof window !== 'undefined'
        ? new EventSource(EMERGENCY_EVENTS_URL, { withCredentials: true })
        : null;

    const handleRealtimeUpdate = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        console.log('✅ Medical SSE update:', parsed.type || 'unknown');
      } catch {
        console.log('✅ Medical SSE update received');
      }
      void fetchData();
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
      console.log('✅ Medical SSE connected');
    });

    eventSource?.addEventListener('error', () => {
      console.warn('Medical SSE disconnected, browser will retry automatically');
    });

    const interval = setInterval(fetchData, 15000);
    return () => {
      eventSource?.close();
      clearInterval(interval);
    };
  }, [fetchData]);

const handleAcceptIncident = async (incident: MedicalIncident) => {
  setActionLoading(`accept-${incident.id}`);
  
  try {
    const dispatchRes = await axios.post(`${EMERGENCY_SERVICE}/dispatch/manual`, {
      incident_id: incident.id,
      responder_id: String(user?.id),
      responder_role: 'medic',
      current_position: currentLocation,
      responder_name: user?.email?.split('@')[0] || 'Médico',
    }, {
      withCredentials: true,
    });

    const dispatchId = dispatchRes.data?.id;
    if (dispatchId) {
      await api.acceptDispatch(dispatchId);
    }

    await fetchData();
  } catch (error) {
    console.error('Erro ao aceitar incidente:', error);
    alert('Erro ao aceitar incidente. Tente novamente.');
  } finally {
    setActionLoading(null);
  }
};

const isSameLocation = (fromNode: string, toNode: string): boolean => {
  return fromNode === toNode;
};

const handleAcceptAssignedDispatch = async (dispatch: MyDispatch) => {
  setActionLoading(`accept-dispatch-${dispatch.id}`);

  try {
    await api.acceptDispatch(dispatch.id);
    await fetchData();
  } catch (error) {
    console.error('Erro ao aceitar pedido médico:', error);
    alert('❌ Não foi possível aceitar este pedido.');
  } finally {
    setActionLoading(null);
  }
};


const handleNavigate = async (incident: MedicalIncident) => {
  setActionLoading(`nav-${incident.id}`);
  setRouteInfo(null);
  setRouteModalIncident(incident);
  setRouteModalGeoJson(null);
  setRouteModalError(null);
  setRouteModalLoading(true);
  
  try {
    const fromNode = currentLocation;
    const toNode = incident.location_node;
    
    if (isSameLocation(fromNode, toNode)) {
      setRouteModalError(`Já estás no local do incidente (${toNode}).`);
      return;
    }
    
    const [route, geoJsonRoute] = await Promise.all([
      api.getRoute(fromNode, toNode),
      indoorRoutingService.getRouteGeoJson(Number(fromNode), Number(toNode)),
    ]);
    
    setRouteInfo({
      distance: route.distance,
      eta_seconds: route.eta_seconds,
      waypoints: route.waypoints,
    });

    setRouteModalGeoJson(geoJsonRoute);
    const firstFloor = geoJsonRoute.summary.floors[0];
    if (firstFloor != null) {
      setRouteModalFloor(String(firstFloor) as '0' | '1' | '2');
    }

    setNavigation({
      taskId: incident.id,
      binId: incident.id,
      binName: incident.description || 'Incidente Médico',
      targetNode: toNode,
      fromNode,
      waypoints: route.waypoints,
      etaSeconds: route.eta_seconds,
    });
  } catch (error) {
    console.error('Erro ao calcular rota:', error);
    setRouteModalError('Não foi possível calcular a rota.');
  } finally {
    setActionLoading(null);
    setRouteModalLoading(false);
  }
};

const handleArrive = async (dispatch: MyDispatch) => {
  setActionLoading(`arrive-${dispatch.id}`);
  try {
    // Marcar chegada no backend
    await axios.post(`${EMERGENCY_SERVICE}/dispatch/${dispatch.id}/arrived`);
    
    // Encontrar o incidente correspondente
    const incident = incidents.find(i => i.id === dispatch.incident_id);
    
    if (incident) {
      // Atualizar localização do médico
      try {
        await axios.patch(`${MAINTENANCE_SERVICE}/staff/${user?.id}/location`, null, {
          params: { location: incident.location_node }
        });
        setCurrentLocation(incident.location_node);
      } catch (e) {
        console.log('Maintenance Service não disponível');
      }
    }
    
    await fetchData();
    alert(`✅ Chegou ao local do incidente!`);
    
  } catch (error) {
    console.error('Erro ao marcar chegada:', error);
    alert('❌ Erro ao marcar chegada.');
  } finally {
    setActionLoading(null);
  }
};

  const handleRefuseDispatch = async (dispatch: MyDispatch) => {
    if (!confirm('Queres recusar este incidente médico?')) return;

    setActionLoading(`refuse-${dispatch.id}`);
    try {
      await api.refuseDispatch(dispatch.id);
      await fetchData();
      alert('Incidente recusado.');
    } catch (error) {
      console.error('Erro ao recusar incidente:', error);
      alert('❌ Não foi possível recusar este incidente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteDispatch = async (dispatch: MyDispatch, incident: MedicalIncident) => {
    const notes = window.prompt(
      'Descreve brevemente o atendimento realizado:',
      'Atendimento médico concluído.'
    );

    if (!notes || notes.trim().length < 3) return;

    setActionLoading(`complete-${dispatch.id}`);
    try {
      await api.completeDispatch(dispatch.id, notes.trim());
      await fetchData();
      alert(`✅ Atendimento do incidente ${incident.id} concluído. O supervisor já pode fechar o incidente.`);
      setSelectedIncident(null);
    } catch (error) {
      console.error('Erro ao concluir atendimento:', error);
      alert('❌ Não foi possível concluir o atendimento.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffMins < 1440) return `há ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('pt-PT');
  };

  // Incidentes que ainda não foram aceites por ninguém
  const pendingIncidents = incidents.filter(incident => 
    !myDispatches.some(d => d.incident_id === incident.id)
  );

  // Pedidos atribuídos pelo supervisor, mas ainda não aceites pelo médico
  const assignedIncidents = incidents.filter(incident =>
    myDispatches.some(d => d.incident_id === incident.id && d.status === 'dispatched')
  );

  // Meus incidentes já aceites/em atendimento
  const myActiveIncidents = incidents.filter(incident =>
    myDispatches.some(d => d.incident_id === incident.id && d.status !== 'dispatched')
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">A carregar incidentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <Stethoscope size={28} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Incidentes Médicos</h1>
              <p className="text-gray-500 mt-1">
                {pendingIncidents.length + assignedIncidents.length} por aceitar • {myActiveIncidents.length} em andamento
              </p>
              <p className="text-xs text-gray-400 mt-1">
                📍 Localização atual: {currentLocation}
              </p>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => fetchData()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Pedidos atribuídos ao médico, mas ainda pendentes de aceitação */}
      {assignedIncidents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            Pedidos por aceitar ({assignedIncidents.length})
          </h2>
          <div className="space-y-4">
            {assignedIncidents.map((incident) => {
              const dispatch = myDispatches.find(d => d.incident_id === incident.id);

              return (
                <div key={incident.id} className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {SEVERITY_ICONS[incident.severity]}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {incident.description || 'Emergência Médica'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_COLORS[incident.severity]}`}>
                              {incident.severity.toUpperCase()}
                            </span>
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-gray-400" />
                              <span className="text-xs text-gray-500">{incident.location_node}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        <Clock size={14} />
                        <span>A aguardar aceitação</span>
                      </div>
                    </div>

                    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      <p className="font-semibold">Pedido atribuído pelo supervisor</p>
                      <p className="mt-1 leading-relaxed">
                        Aceita o pedido para ficares responsável por este atendimento. Só depois aparecem as ações de rota, chegada e conclusão.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      {dispatch && (
                        <button
                          onClick={() => handleAcceptAssignedDispatch(dispatch)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <CheckCircle size={18} />
                          Aceitar Pedido
                        </button>
                      )}

                      {dispatch && (
                        <button
                          onClick={() => handleRefuseDispatch(dispatch)}
                          disabled={!!actionLoading}
                          className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 bg-white text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={18} />
                          Recusar
                        </button>
                      )}

                      <button
                        onClick={() => router.push(`/app-routes/chat?incident=${incident.id}`)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <MessageCircle size={18} />
                        Chat
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meus Incidentes em Andamento */}
      {myActiveIncidents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Ambulance size={20} className="text-red-500" />
            Em Andamento ({myActiveIncidents.length})
          </h2>
          <div className="space-y-4">
            {myActiveIncidents.map((incident) => {
              const dispatch = myDispatches.find(d => d.incident_id === incident.id);
              const statusInfo = dispatch ? STATUS_BADGES[dispatch.status] : STATUS_BADGES.dispatched;
              const guidance = getDispatchGuidance(dispatch?.status);
              
              return (
                <div key={incident.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {SEVERITY_ICONS[incident.severity]}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {incident.description || 'Emergência Médica'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_COLORS[incident.severity]}`}>
                              {incident.severity.toUpperCase()}
                            </span>
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-gray-400" />
                              <span className="text-xs text-gray-500">{incident.location_node}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusInfo.color}`}>
                        {statusInfo.icon}
                        <span>{statusInfo.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{formatTime(incident.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User size={14} />
                        <span>Reportado por: {incident.reported_by || 'Sistema'}</span>
                      </div>
                    </div>

                    {guidance && (
                      <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${guidance.className}`}>
                        <p className="font-semibold">{guidance.title}</p>
                        <p className="mt-1 leading-relaxed">{guidance.description}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {dispatch?.status === 'en_route' && (
                        <>
                          <button
                            onClick={() => handleNavigate(incident)}
                            disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Navigation size={18} />
                            Ver Rota
                          </button>
                          <button
                            onClick={() => dispatch && handleArrive(dispatch)}
                            disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            <Flag size={18} />
                            Cheguei ao Local
                          </button>
                        </>
                      )}
                      
                      {dispatch?.status === 'arrived' && (
                        <button
                          onClick={() => dispatch && handleCompleteDispatch(dispatch, incident)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle size={18} />
                          Concluir Atendimento
                        </button>
                      )}

                      {dispatch && ['en_route', 'arrived'].includes(dispatch.status) && (
                        <button
                          onClick={() => handleRefuseDispatch(dispatch)}
                          disabled={!!actionLoading}
                          className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 bg-white text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={18} />
                          Recusar
                        </button>
                      )}
                      
                      <button
                        onClick={() => router.push(`/app-routes/chat?incident=${incident.id}`)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <MessageCircle size={18} />
                        Chat
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incidentes Pendentes */}
      {pendingIncidents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-500" />
            Pendentes ({pendingIncidents.length})
          </h2>
          <div className="space-y-4">
            {pendingIncidents.map((incident) => (
              <div key={incident.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {SEVERITY_ICONS[incident.severity]}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {incident.description || 'Emergência Médica'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_COLORS[incident.severity]}`}>
                            {incident.severity.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" />
                            <span className="text-xs text-gray-500">{incident.location_node}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{formatTime(incident.created_at)}</span>
                  </div>

                  <div className="flex gap-3 mt-4">
<button
  onClick={() => handleAcceptIncident(incident)}
  disabled={actionLoading === `accept-${incident.id}`}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
  style={{
    backgroundColor: isSameLocation(currentLocation, incident.location_node) 
      ? '#10B981'  // Verde se já está no local
      : '#EF4444', // Vermelho se precisa ir
    color: 'white'
  }}
>
  {actionLoading === `accept-${incident.id}` ? (
    <Loader2 size={18} className="animate-spin" />
  ) : isSameLocation(currentLocation, incident.location_node) ? (
    <>
      <CheckCircle size={18} />
      Estou no Local
    </>
  ) : (
    <>
      <HeartPulse size={18} />
      Aceitar Incidente
    </>
  )}
</button>
                    
                    <button
                      onClick={() => setSelectedIncident(incident)}
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      <Eye size={18} />
                      Detalhes
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sem incidentes */}
      {pendingIncidents.length === 0 && assignedIncidents.length === 0 && myActiveIncidents.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum incidente ativo</h3>
          <p className="text-gray-500">Não há incidentes médicos pendentes no momento.</p>
        </div>
      )}

      {/* Modal de rota inline */}
      {routeModalIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/45 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Rota do atendimento</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {routeModalIncident.description || 'Emergência Médica'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  De {currentLocation} até nó {routeModalIncident.location_node}
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
                    setRouteModalIncident(null);
                    setRouteModalGeoJson(null);
                    setRouteModalError(null);
                  }}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar rota"
                >
                  <XCircle size={22} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {routeModalLoading ? (
                <div className="flex h-[32rem] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                  <Loader2 size={18} className="mr-2 animate-spin" />
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

      {/* Modal de Detalhes do Incidente */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {SEVERITY_ICONS[selectedIncident.severity]}
                  <h2 className="text-xl font-bold text-gray-900">Detalhes do Incidente</h2>
                </div>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <XCircle size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Descrição</p>
                  <p className="text-gray-900">{selectedIncident.description || 'Sem descrição adicional'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={14} className="text-gray-500" />
                      <p className="text-sm text-gray-500">Localização</p>
                    </div>
                    <p className="text-gray-900 font-medium">{selectedIncident.location_node}</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar size={14} className="text-gray-500" />
                      <p className="text-sm text-gray-500">Reportado em</p>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedIncident.created_at).toLocaleString('pt-PT')}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-gray-500" />
                    <p className="text-sm text-gray-500">Reportado por</p>
                  </div>
                  <p className="text-gray-900">{selectedIncident.reported_by || 'Sistema'}</p>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      setSelectedIncident(null);
                      handleAcceptIncident(selectedIncident);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <HeartPulse size={18} />
                    Aceitar Incidente
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedIncident(null);
                      router.push(`/app-routes/chat?incident=${selectedIncident.id}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <MessageCircle size={18} />
                    Contactar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
