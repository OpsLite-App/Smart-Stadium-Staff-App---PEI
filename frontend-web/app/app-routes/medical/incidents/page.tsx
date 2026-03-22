'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api } from '@/lib/services/api';
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
  Bandage,
  Pill,
  Syringe,
  Brain,
  Bone,
  Thermometer,
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
  status: 'dispatched' | 'en_route' | 'arrived' | 'completed';
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
};

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
  const [routeInfo, setRouteInfo] = useState<{ distance: number; eta_seconds: number; waypoints: any[] } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string>('N1'); // ✅ Estado para localização atual

  // ✅ Função para buscar a localização atual do médico
  const fetchCurrentLocation = useCallback(async () => {
    if (!user?.id) return 'N1';
    
    try {
      // Tentar buscar do Maintenance Service (staff coordinator)
      const response = await axios.get<StaffLocation[]>(`http://localhost:8007/api/maintenance/staff`, {
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
      // Fallback: tentar buscar do Auth Service
      const response = await axios.get(`http://localhost:8081/auth/staff/${user.id}`, {
        timeout: 3000,
      });
      
      const location = response.data?.current_location || response.data?.location;
      if (location) {
        setCurrentLocation(location);
        return location;
      }
    } catch (error) {
      console.log('Auth Service não disponível, usando localização padrão');
    }
    
    return 'N1';
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      // ✅ Buscar localização atual do médico
      await fetchCurrentLocation();
      
      // Buscar incidentes médicos ativos
      const incidentsRes = await axios.get('http://localhost:8006/api/emergency/incidents', {
        params: { incident_type: 'medical', status: 'active' },
        timeout: 5000,
      });
      
      // Buscar meus despachos ativos
      const dispatchesRes = await axios.get('http://localhost:8006/api/emergency/dispatch/active', {
        timeout: 5000,
      });
      
      // Filtrar despachos do médico atual
      const myActiveDispatches = (dispatchesRes.data || []).filter(
        (d: any) => d.responder_id === String(user.id) && d.status !== 'completed'
      );
      
      setIncidents(incidentsRes.data?.incidents || []);
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
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

const handleAcceptIncident = async (incident: MedicalIncident) => {
  setActionLoading(`accept-${incident.id}`);
  
  try {
    // 1. Despachar médico para o incidente
    const dispatchRes = await axios.post('http://localhost:8006/api/emergency/dispatch', {
      incident_id: incident.id,
      responder_role: 'medical',
      num_responders: 1
    });
    
    // Guardar o ID do despacho criado
    const dispatchId = dispatchRes.data?.[0]?.id || dispatchRes.data?.id;
    
    // 2. Buscar localização atual
    const fromNode = currentLocation;
    const toNode = incident.location_node;
    
    // 3. Verificar se já está no local
    if (isSameLocation(fromNode, toNode)) {
      // Se já está no local, marcar como arrived
      if (dispatchId) {
        await axios.post(`http://localhost:8006/api/emergency/dispatch/${dispatchId}/arrived`);
      }
      await fetchData();
      alert(`Você já está no local do incidente em ${toNode}!`);
      return;
    }
    
    // 4. Calcular rota (apenas se estiver em local diferente)
    console.log(`📍 Calculando rota de ${fromNode} para ${toNode}`);
    const route = await api.getRoute(fromNode, toNode);
    
    // 5. Iniciar navegação
    setNavigation({
      taskId: incident.id,
      binId: incident.id,
      binName: incident.description || 'Incidente Médico',
      targetNode: toNode,
      fromNode,
      waypoints: route.waypoints,
      etaSeconds: route.eta_seconds,
    });
    
    // 6. Recarregar dados
    await fetchData();
    
    // 7. Redirecionar para o mapa
    router.push('/app-routes/map');
    
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


const handleNavigate = async (incident: MedicalIncident) => {
  setActionLoading(`nav-${incident.id}`);
  setRouteInfo(null);
  
  try {
    const fromNode = currentLocation;
    const toNode = incident.location_node;
    
    // Verificar se já está no local
    if (isSameLocation(fromNode, toNode)) {
      alert(`Você já está no local do incidente em ${toNode}!`);
      setSelectedIncident(incident);
      return;
    }
    
    console.log(`📍 Calculando rota de ${fromNode} para ${toNode}`);
    const route = await api.getRoute(fromNode, toNode);
    
    setRouteInfo({
      distance: route.distance,
      eta_seconds: route.eta_seconds,
      waypoints: route.waypoints,
    });
    
    setShowMap(true);
    setSelectedIncident(incident);
    
    // Iniciar navegação
    setNavigation({
      taskId: incident.id,
      binId: incident.id,
      binName: incident.description || 'Incidente Médico',
      targetNode: toNode,
      fromNode,
      waypoints: route.waypoints,
      etaSeconds: route.eta_seconds,
    });
    
    router.push('/app-routes/map');
    
  } catch (error) {
    console.error('Erro ao calcular rota:', error);
    alert('❌ Não foi possível calcular a rota.');
  } finally {
    setActionLoading(null);
  }
};

const handleArrive = async (dispatch: MyDispatch) => {
  setActionLoading(`arrive-${dispatch.id}`);
  try {
    // Marcar chegada no backend
    await axios.post(`http://localhost:8006/api/emergency/dispatch/${dispatch.id}/arrived`);
    
    // Encontrar o incidente correspondente
    const incident = incidents.find(i => i.id === dispatch.incident_id);
    
    if (incident) {
      // Atualizar localização do médico
      try {
        await axios.patch(`http://localhost:8007/api/maintenance/staff/${user?.id}/location`, null, {
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

  const handleResolve = async (incident: MedicalIncident) => {
    setActionLoading(`resolve-${incident.id}`);
    try {
      await axios.patch(`http://localhost:8006/api/emergency/incidents/${incident.id}`, {
        status: 'resolved',
        notes: 'Atendimento médico concluído'
      });
      
      await fetchData();
      alert(`✅ Incidente ${incident.id} resolvido com sucesso!`);
      setSelectedIncident(null);
    } catch (error) {
      console.error('Erro ao resolver incidente:', error);
      alert('❌ Erro ao resolver incidente.');
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

  // Meus incidentes em andamento
  const myActiveIncidents = incidents.filter(incident =>
    myDispatches.some(d => d.incident_id === incident.id)
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
                {pendingIncidents.length} pendentes • {myActiveIncidents.length} em andamento
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

                    <div className="flex gap-3">
                      {dispatch?.status === 'dispatched' && (
                        <button
                          onClick={() => handleNavigate(incident)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Navigation size={18} />
                          Iniciar Rota
                        </button>
                      )}
                      
                      {dispatch?.status === 'en_route' && (
                        <button
                          onClick={() => dispatch && handleArrive(dispatch)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <Flag size={18} />
                          Cheguei ao Local
                        </button>
                      )}
                      
                      {dispatch?.status === 'arrived' && (
                        <button
                          onClick={() => handleResolve(incident)}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle size={18} />
                          Resolver Incidente
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
      {pendingIncidents.length === 0 && myActiveIncidents.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum incidente ativo</h3>
          <p className="text-gray-500">Não há incidentes médicos pendentes no momento.</p>
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