// app/app-routes/alerts/page.tsx
'use client';
import { Client } from '@stomp/stompjs';
import { WS_GATEWAY, api } from '@/lib/services/api';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { EMERGENCY_SERVICE } from '@/lib/services/api';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
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

type FilterTimeRange = 'all' | 'today' | 'hour' | '24h';
const PGR_NODE_OPTIONS = ['1', '50', '51', '52', '53', '58', '62', '63', '65', '66', '70', '71', '90', '98', '103'];
const DEFAULT_INCIDENT_NODE = '62';

// Alert types
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
  metadata?: Record<string, unknown>;
}

// Alert statistics
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

interface EmergencyIncidentAdmin {
  id: string;
  incident_type: string;
  status: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location_node: string;
  description?: string;
  responders_dispatched: number;
  created_at: string;
  resolved_at?: string | null;
  notes?: string | null;
}

interface StaffCandidate {
  id: string;
  name: string;
  role: string;
  location: string;
  availability: 'available' | 'busy';
  etaSeconds: number | null;
  distance: number | null;
}

interface StaffApiEntry {
  id: number | string;
  name: string;
  role: string;
  location?: string;
  current_location?: string;
}

interface ActiveDispatchEntry {
  id?: string;
  incident_id?: string;
  responder_id: string;
  responder_role: string;
  eta_seconds: number;
  status: string;
  dispatched_at?: string;
  en_route_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  incident_metadata?: {
    responder_name?: string | null;
    completion_notes?: string | null;
    assigned_from?: string | null;
    false_alarm?: boolean | null;
    closed_by_supervisor?: boolean | null;
    cancelled_by_supervisor?: boolean | null;
    supervisor_notes?: string | null;
  };
}

interface MaintenanceTask {
  id: string;
  task_type: string;
  location_node: string;
  priority: string;
  status: string;
  description?: string;
  assigned_to?: string;
  main_metadata?: { bin_id?: string; fill_percentage?: number };
}

const ALERT_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

function normalizeSeverity(value: unknown): Alert['severity'] {
  if (typeof value === 'string' && (ALERT_SEVERITIES as readonly string[]).includes(value)) {
    return value as Alert['severity'];
  }
  return 'medium';
}

function safeTimestamp(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) {
    return value;
  }
  return new Date().toISOString();
}

function normalizeEmergencyAlert(raw: Record<string, unknown>): Alert {
  const sensorType = typeof raw.sensor_type === 'string' ? raw.sensor_type : 'sensor';
  const reading = typeof raw.reading_value === 'number' ? raw.reading_value : undefined;
  const threshold = typeof raw.threshold === 'number' ? raw.threshold : undefined;
  const unit = typeof raw.unit === 'string' ? raw.unit : '';
  const status = typeof raw.status === 'string' ? raw.status : 'active';
  const locationNode = typeof raw.location_node === 'string' ? raw.location_node : 'Desconhecido';

  return {
    id: String(raw.id ?? raw.incident_id ?? `emergency-${Date.now()}`),
    type: 'emergency',
    severity: normalizeSeverity(raw.severity),
    title: `Alerta de ${sensorType}`,
    description:
      reading !== undefined && threshold !== undefined
        ? `Leitura ${reading}${unit ? ` ${unit}` : ''} (limite ${threshold}${unit ? ` ${unit}` : ''}).`
        : 'Alerta de sensor recebido.',
    location: `Nó ${locationNode}`,
    location_details: {
      node_id: locationNode,
    },
    timestamp: safeTimestamp(raw.detected_at),
    read: status === 'acknowledged' || status === 'resolved',
    acknowledged: status === 'acknowledged' || status === 'resolved' || !!raw.acknowledged_at,
    resolved: status === 'resolved' || !!raw.resolved_at,
    resolved_at: typeof raw.resolved_at === 'string' ? raw.resolved_at : undefined,
    source: 'api',
    metadata:
      raw.incident_metadata && typeof raw.incident_metadata === 'object'
        ? (raw.incident_metadata as Record<string, unknown>)
        : {},
  };
}

function normalizeIncidentAlert(incident: EmergencyIncidentAdmin): Alert {
  const resolved = incident.status === 'resolved' || incident.status === 'false_alarm' || Boolean(incident.resolved_at);

  return {
    id: incident.id,
    type: incident.incident_type === 'security' ? 'security' : 'emergency',
    severity: normalizeSeverity(incident.severity),
    title: `${incident.incident_type} em ${incident.location_node}`,
    description: incident.description || incident.notes || 'Incidente registado sem descrição adicional.',
    location: `Nó ${incident.location_node}`,
    location_details: {
      node_id: incident.location_node,
    },
    timestamp: safeTimestamp(incident.created_at),
    read: resolved,
    acknowledged: incident.status !== 'active',
    resolved,
    resolved_at: incident.resolved_at ?? undefined,
    source: 'api',
    metadata: {
      incident_id: incident.id,
      incident_status: incident.status,
      responders_dispatched: incident.responders_dispatched,
    },
  };
}

function isTerminalIncident(incident?: EmergencyIncidentAdmin | null) {
  const status = String(incident?.status ?? '').toLowerCase();
  return status === 'resolved' || status === 'false_alarm' || Boolean(incident?.resolved_at);
}

function hasCompletedDispatch(dispatches: ActiveDispatchEntry[]) {
  return dispatches.some((dispatch) => String(dispatch.status ?? '').toLowerCase() === 'completed');
}

function getIncidentActionError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export default function AlertsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { setNavigation } = useNavigationStore();
  const canManageIncidents = Boolean(user?.permissions.canManageIncidents);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<EmergencyIncidentAdmin[]>([]);
  const [incidentDispatches, setIncidentDispatches] = useState<Record<string, ActiveDispatchEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [incidentActionLoading, setIncidentActionLoading] = useState<string | null>(null);
  const [incidentNodeError, setIncidentNodeError] = useState('');
  const [incidentForm, setIncidentForm] = useState({
    incident_type: 'medical',
    location_node: DEFAULT_INCIDENT_NODE,
    severity: 'medium',
    description: '',
  });
  const [assigningIncident, setAssigningIncident] = useState<EmergencyIncidentAdmin | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<'security' | 'cleaning' | 'supervisor' | 'medical'>('security');
  const [staffCandidates, setStaffCandidates] = useState<StaffCandidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
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

  // Filters
  const [filters, setFilters] = useState({
    severity: [] as string[],
    type: [] as string[],
    showResolved: false,
    showRead: true,
    timeRange: 'all' as FilterTimeRange
  });

  // Expansion state
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const resolvedOverridesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('alerts-resolved-overrides');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        resolvedOverridesRef.current = parsed;
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const persistResolvedOverrides = (overrides: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('alerts-resolved-overrides', JSON.stringify(overrides));
  };

  const fetchAlerts = async () => {
    try {
      setRefreshing(true);
      const [incidentResponse, staffResponse] = await Promise.all([
        axios.get<{ incidents?: EmergencyIncidentAdmin[] }>(
          `${EMERGENCY_SERVICE}/incidents`,
          { timeout: 3000 }
        ),
        axios.get<StaffApiEntry[]>(`/api/auth/staff`, { timeout: 4000, withCredentials: true }).catch(() => ({ data: [] })),
      ]);

      const loadedIncidents = incidentResponse.data?.incidents || [];
      const staffNameById = new Map((staffResponse.data || []).map((member) => [String(member.id), member.name]));
      const dispatchEntries = await Promise.all(
        loadedIncidents.map(async (incident) => {
          try {
            const response = await axios.get<ActiveDispatchEntry[]>(
              `${EMERGENCY_SERVICE}/dispatch/incident/${incident.id}`,
              { timeout: 3000 }
            );
            return [
              incident.id,
              (response.data || []).map((dispatch) => ({
                ...dispatch,
                incident_metadata: {
                  ...dispatch.incident_metadata,
                  responder_name:
                    dispatch.incident_metadata?.responder_name ||
                    staffNameById.get(String(dispatch.responder_id)) ||
                    null,
                },
              })),
            ] as const;
          } catch {
            return [incident.id, []] as const;
          }
        })
      );

      setIncidents(loadedIncidents);
      setIncidentDispatches(Object.fromEntries(dispatchEntries));

      let allAlerts: Alert[] = loadedIncidents.map(normalizeIncidentAlert);

      // Reapply local resolved overrides after polling to avoid reappearing alerts
      allAlerts = allAlerts.map((alert) => {
        const resolvedAt = resolvedOverridesRef.current[alert.id];
        if (!resolvedAt) return alert;
        return {
          ...alert,
          resolved: true,
          resolved_at: resolvedAt,
          read: true,
          acknowledged: true,
        };
      });

      // Sort by timestamp (most recent first)
      allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlerts(allAlerts);
      calculateStats(allAlerts);
      
    } catch (error) {
      console.error('❌ Error while fetching alerts:', error);
      setAlerts([]);
      calculateStats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    }
  };

  // Calculate statistics
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
      // Unread
      if (!alert.read) newStats.unread++;

      // Unresolved
      if (!alert.resolved) {
        newStats.unresolved++;

        // Count by severity (active only)
        switch (alert.severity) {
          case 'critical': newStats.critical++; break;
          case 'high': newStats.high++; break;
          case 'medium': newStats.medium++; break;
          case 'low': newStats.low++; break;
          case 'info': newStats.info++; break;
        }

        // Count by type (active only)
        if (alert.type in newStats.byType) {
          newStats.byType[alert.type as keyof typeof newStats.byType]++;
        }
      }
    });

    setStats(newStats);
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...alerts];

    // Filter by severity
    if (filters.severity.length > 0) {
      filtered = filtered.filter(alert => filters.severity.includes(alert.severity));
    }

    // Filter by type
    if (filters.type.length > 0) {
      filtered = filtered.filter(alert => filters.type.includes(alert.type));
    }

    // Filter resolved
    if (!filters.showResolved) {
      filtered = filtered.filter(alert => !alert.resolved);
    }

    // Filter read
    if (!filters.showRead) {
      filtered = filtered.filter(alert => !alert.read);
    }

    // Filter by time
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

  useEffect(() => {
    fetchAlerts();

    // WebSocket for real-time alerts
    // STOMP WebSocket for real-time alerts
    const client = new Client({
      brokerURL: WS_GATEWAY,
      connectHeaders: {},

      debug: (str) => {
        console.log('STOMP:', str);
      },

      onConnect: () => {
        console.log('✅ STOMP connected (alerts)');

        client.subscribe('/topic/emergency', () => {
          try {
            void fetchAlerts();
          } catch (e) {
            console.error('Error processing emergency alert:', e);
          }
        });
      },

      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message']);
      },

      onWebSocketError: (e) => {
        console.warn('WebSocket error:', e);
      },

      onWebSocketClose: () => {
        console.warn('WebSocket closed');
      }
    });

    client.activate();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      setRefreshing(true);
      void fetchAlerts();
    }, 30000);

    return () => {
      client.deactivate();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!assigningIncident) return;
    void loadCandidatesForIncident(assigningIncident, selectedDepartment);
  }, [assigningIncident, selectedDepartment]);

  // Mark alert as read
  const markAsRead = (alertId: string) => {
    setAlerts(prev => {
      const updated = prev.map(alert => 
        alert.id === alertId ? { ...alert, read: true } : alert
      );
      calculateStats(updated);
      return updated;
    });
  };

  // Mark alert as acknowledged
  const acknowledgeAlert = async (alertId: string) => {
    if (!user) return;

    try {
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
      console.error('Error acknowledging alert:', error);
    }
  };

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    if (!user) return;
    const resolvedAt = new Date().toISOString();

    try {
      const updated = await updateIncidentStatus(alertId, 'resolved');
      if (!updated) return;

      resolvedOverridesRef.current = { ...resolvedOverridesRef.current, [alertId]: resolvedAt };
      persistResolvedOverrides(resolvedOverridesRef.current);

      setAlerts(prev => {
        const updated = prev.map(alert => 
          alert.id === alertId ? { 
            ...alert, 
            resolved: true,
            resolved_at: resolvedAt
          } : alert
        );
        calculateStats(updated);
        return updated;
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  };

  const createIncident = async () => {
    if (!user?.permissions.canCreateIncidents) return;

    // Validate that the selected node can be used by pgRouting. A self-route is
    // empty in pgRouting, so validate against a known connected node instead.
    try {
      const validationTarget =
        incidentForm.location_node === DEFAULT_INCIDENT_NODE ? '66' : DEFAULT_INCIDENT_NODE;

      await axios.get(`/api/routing/route`, {
        params: { from_node: incidentForm.location_node, to_node: validationTarget },
        timeout: 4000,
      });
      setIncidentNodeError('');
    } catch {
      setIncidentNodeError(`Nó "${incidentForm.location_node}" não está disponível para routing.`);
      return;
    }

    try {
      setIncidentActionLoading('create');
      await axios.post(
        `${EMERGENCY_SERVICE}/incidents`,
        {
          incident_type: incidentForm.incident_type,
          location_node: incidentForm.location_node,
          severity: incidentForm.severity,
          description: incidentForm.description || undefined,
          detected_by: 'staff',
          reported_by: String(user.id || user.email),
          incident_metadata: {
            created_from: 'supervisor_alerts_page',
          },
        },
        {
          params: { auto_dispatch: false },
        }
      );

      setIncidentForm({
        incident_type: 'medical',
        location_node: DEFAULT_INCIDENT_NODE,
        severity: 'medium',
        description: '',
      });

      await fetchAlerts();
    } catch (error) {
      console.error('Error creating incident:', error);
    } finally {
      setIncidentActionLoading(null);
    }
  };

  const loadCandidatesForIncident = async (
    incident: EmergencyIncidentAdmin,
    department: 'security' | 'cleaning' | 'supervisor' | 'medical'
  ) => {
    try {
      setCandidateLoading(true);
      setCandidateError('');

      const [staffResponse, activeDispatchesResponse] = await Promise.all([
        axios.get<StaffApiEntry[]>(`/api/auth/staff`, { timeout: 4000, withCredentials: true }),
        axios.get<ActiveDispatchEntry[]>(`${EMERGENCY_SERVICE}/dispatch/active`, { timeout: 4000 }).catch(() => ({ data: [] })),
      ]);

      const roleMatchers: Record<typeof department, string[]> = {
        security: ['security'],
        cleaning: ['cleaning', 'maintenance'],
        supervisor: ['supervisor'],
        medical: ['medical', 'medic'],
      };

      const busyStatuses = new Set(['dispatched', 'en_route', 'arrived']);
      const busyIds = new Set(
        (activeDispatchesResponse.data || [])
          .filter((item) => busyStatuses.has(String(item.status ?? '').toLowerCase()))
          .map((item) => String(item.responder_id))
      );

      const filteredStaff = (staffResponse.data || []).filter((member) =>
        roleMatchers[department].some((role) => String(member.role || '').toLowerCase().includes(role))
      );

      const candidatesWithEta = await Promise.all(
        filteredStaff.map(async (member) => {
          const location = member.current_location || member.location || DEFAULT_INCIDENT_NODE;
          try {
            const routeResponse = await axios.get<{ distance?: number; eta_seconds?: number }>(`/api/routing/route`, {
              params: {
                from_node: location,
                to_node: incident.location_node,
                avoid_crowds: true,
              },
              timeout: 4000,
            });

            return {
              id: String(member.id),
              name: member.name || `Staff ${member.id}`,
              role: member.role || department,
              location,
              availability: busyIds.has(String(member.id)) ? 'busy' : 'available',
              etaSeconds: routeResponse.data?.eta_seconds ?? null,
              distance: routeResponse.data?.distance ?? null,
            } satisfies StaffCandidate;
          } catch {
            return {
              id: String(member.id),
              name: member.name || `Staff ${member.id}`,
              role: member.role || department,
              location,
              availability: busyIds.has(String(member.id)) ? 'busy' : 'available',
              etaSeconds: null,
              distance: null,
            } satisfies StaffCandidate;
          }
        })
      );

      candidatesWithEta.sort((a, b) => {
        const etaA = a.etaSeconds ?? Number.MAX_SAFE_INTEGER;
        const etaB = b.etaSeconds ?? Number.MAX_SAFE_INTEGER;
        return etaA - etaB;
      });

      setStaffCandidates(candidatesWithEta);
    } catch (error) {
      console.error('Error loading staff candidates:', error);
      setCandidateError('Não foi possível carregar candidatos para atribuição.');
      setStaffCandidates([]);
    } finally {
      setCandidateLoading(false);
    }
  };

  const openAssignModal = async (incident: EmergencyIncidentAdmin) => {
    if (isTerminalIncident(incident)) {
      setShowSuccessToast('Este incidente já está fechado e não permite novas atribuições.');
      setTimeout(() => setShowSuccessToast(null), 4000);
      return;
    }

    const defaultDepartment =
      incident.incident_type === 'medical'
        ? 'medical'
        : incident.incident_type === 'fire' || incident.incident_type === 'smoke' || incident.incident_type === 'security'
        ? 'security'
        : 'cleaning';

    setAssigningIncident(incident);
    setSelectedDepartment(defaultDepartment);
    await loadCandidatesForIncident(incident, defaultDepartment);
  };

  const dispatchSpecificCandidate = async (incident: EmergencyIncidentAdmin, candidate: StaffCandidate) => {
    if (!user?.permissions.canDispatchIncidents) return;
    if (isTerminalIncident(incident)) {
      setShowSuccessToast('Este incidente já está fechado e não permite novas atribuições.');
      setTimeout(() => setShowSuccessToast(null), 4000);
      return;
    }

    try {
      setIncidentActionLoading(`dispatch-${incident.id}-${candidate.id}`);
      const route = await api.getRoute(candidate.location, incident.location_node);

      await axios.post(`${EMERGENCY_SERVICE}/dispatch/manual`, {
        incident_id: incident.id,
        responder_id: candidate.id,
        responder_role: selectedDepartment,
        current_position: candidate.location,
        responder_name: candidate.name,
      });

      setNavigation({
        taskId: `incident-${incident.id}`,
        binId: incident.id,
        binName: `${incident.incident_type.toUpperCase()} em node ${incident.location_node}`,
        targetNode: incident.location_node,
        fromNode: candidate.location,
        waypoints: route.waypoints,
        etaSeconds: route.eta_seconds,
      });

      setAssigningIncident(null);
      setStaffCandidates([]);
      setShowSuccessToast(`${candidate.name} atribuído com sucesso ao incidente!`);
      setTimeout(() => setShowSuccessToast(null), 4000);
      await fetchAlerts();
      router.push('/app-routes/map');
    } catch (error) {
      console.error('Error dispatching specific candidate:', error);
      setShowSuccessToast(getIncidentActionError(error, 'Não foi possível atribuir este elemento.'));
      setTimeout(() => setShowSuccessToast(null), 4000);
    } finally {
      setIncidentActionLoading(null);
    }
  };

  const updateIncidentStatus = async (incidentId: string, status: string): Promise<boolean> => {
    if (!user?.permissions.canManageIncidents) return false;

    try {
      setIncidentActionLoading(`${status}-${incidentId}`);
      await axios.patch(`${EMERGENCY_SERVICE}/incidents/${incidentId}`, {
        status,
        notes: `Atualizado por supervisor ${user.email}`,
      });
      await fetchAlerts();
      return true;
    } catch (error) {
      console.error('Error updating incident:', error);
      setShowSuccessToast(getIncidentActionError(error, 'Não foi possível atualizar o incidente.'));
      setTimeout(() => setShowSuccessToast(null), 5000);
      return false;
    } finally {
      setIncidentActionLoading(null);
    }
  };

  // Toggle severity filter
  const toggleSeverityFilter = (severity: string) => {
    setFilters(prev => ({
      ...prev,
      severity: prev.severity.includes(severity)
        ? prev.severity.filter(s => s !== severity)
        : [...prev.severity, severity]
    }));
  };

  // Toggle type filter
  const toggleTypeFilter = (type: string) => {
    setFilters(prev => ({
      ...prev,
      type: prev.type.includes(type)
        ? prev.type.filter(t => t !== type)
        : [...prev.type, type]
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      severity: [],
      type: [],
      showResolved: false,
      showRead: true,
      timeRange: 'all'
    });
  };

  // Format relative time
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

  // Get alert type icon
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

  // Get alert type color
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

  // Get severity color
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

  // Get severity icon
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
      <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar alertas...</p>
          </div>
        </div>
    );
  }

  const completedCount = Math.max(0, stats.total - stats.unresolved);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Success toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl animate-fade-in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="font-medium text-sm">{showSuccessToast}</span>
        </div>
      )}

      {/* Map picker modal */}
      {showMapPicker && (
        <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <span className="font-bold text-gray-900">Escolher localização no mapa</span>
              <button onClick={() => setShowMapPicker(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4">Seleciona o nó mais próximo do incidente:</p>
              <div className="grid grid-cols-5 gap-2">
                {PGR_NODE_OPTIONS.map(node => (
                  <button
                    key={node}
                    onClick={() => {
                      setIncidentForm(prev => ({ ...prev, location_node: node }));
                      setIncidentNodeError('');
                      setShowMapPicker(false);
                    }}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
                      incidentForm.location_node === node
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                  >
                    {node}
                  </button>
                ))}
              </div>
              <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-700">
                📍 Selecionado: <span className="font-bold">{incidentForm.location_node}</span>
              </div>
            </div>
          </div>
        </div>
      )}
        {canManageIncidents && (
          <div className="mb-6 max-w-xl">
            <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,#fffdf7,#fff7ea)] p-5">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-amber-700" />
                <h2 className="text-lg font-semibold text-gray-900">Controlo do supervisor</h2>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Aqui a supervisão cria incidentes, faz dispatch manual e fecha ocorrências sem apagar histórico.
              </p>

              <div className="mt-4 grid gap-3">
                <select
                  value={incidentForm.incident_type}
                  onChange={(e) => setIncidentForm((prev) => ({ ...prev, incident_type: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="medical">medical</option>
                  <option value="fire">fire</option>
                  <option value="smoke">smoke</option>
                  <option value="security">security</option>
                  <option value="structural">structural</option>
                  <option value="other">other</option>
                </select>

                <div>
                  <div className="flex gap-2">
                    <select
                      value={incidentForm.location_node}
                      onChange={(e) => { setIncidentForm(prev => ({ ...prev, location_node: e.target.value })); setIncidentNodeError(''); }}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm text-gray-900 ${incidentNodeError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                    >
                      {PGR_NODE_OPTIONS.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 flex items-center gap-1.5"
                      title="Escolher no mapa"
                    >
                      🗺️ Mapa
                    </button>
                  </div>
                  {incidentNodeError && <p className="mt-1 text-xs text-red-600">{incidentNodeError}</p>}
                </div>

                <select
                  value={incidentForm.severity}
                  onChange={(e) => setIncidentForm((prev) => ({ ...prev, severity: e.target.value }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>

                <textarea
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Descrição operacional"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                />

                <button
                  onClick={createIncident}
                  disabled={incidentActionLoading === 'create'}
                  className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  Criar incidente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alertas</h1>
            <p className="text-gray-600 mt-1">
              {stats.unread} não lidos • {stats.unresolved} não resolvidos
            </p>
          </div>
          
          <div className="flex gap-2 mt-4 md:mt-0 items-center">
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Atualizado às {lastUpdated.toLocaleTimeString('pt-PT')}
              </span>
            )}
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
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
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-emerald-500">
            <p className="text-sm text-gray-600">Concluídos</p>
            <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
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
                  onChange={(e) => {
                    const value = e.target.value as FilterTimeRange;
                    setFilters(prev => ({ ...prev, timeRange: value }));
                  }}
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
              const incidentForAlert = incidents.find((incident) => incident.id === alert.id);
              const dispatchesForAlert = incidentDispatches[alert.id] || [];
              const incidentClosed = isTerminalIncident(incidentForAlert);
              const canResolveThisIncident =
                Boolean(incidentForAlert) &&
                !incidentClosed &&
                dispatchesForAlert.length > 0 &&
                hasCompletedDispatch(dispatchesForAlert);
              const resolveDisabledReason =
                !incidentForAlert
                  ? ''
                  : dispatchesForAlert.length === 0
                  ? 'Atribui pelo menos uma pessoa antes de concluir.'
                  : !hasCompletedDispatch(dispatchesForAlert)
                  ? 'Aguarda que pelo menos uma pessoa atribuída conclua a tarefa.'
                  : '';

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
                    <button
                      type="button"
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                      className="mb-3 flex w-full items-start justify-between rounded-xl text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
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

                      <span className="ml-3 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm">
                        {isExpanded ? 'Fechar' : 'Gerir'}
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </span>
                    </button>

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
                          
                          {!alert.acknowledged && user?.permissions.canAcknowledgeAlerts && (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                            >
                              <CheckCheck size={14} />
                              Reconhecer
                            </button>
                          )}
                          
                          {!alert.resolved && user?.permissions.canResolveIncidents && (
                            <button
                              onClick={() => resolveAlert(alert.id)}
                              disabled={!canResolveThisIncident || incidentActionLoading === `resolved-${alert.id}`}
                              title={resolveDisabledReason}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <CheckCircle size={14} />
                              Marcar como resolvido
                            </button>
                          )}

                          {incidentForAlert && canManageIncidents && (
                            <>
                              {!incidentClosed ? (
                                <>
                                  <button
                                    onClick={() => openAssignModal(incidentForAlert)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                  >
                                    <UserCog size={14} />
                                    Atribuir equipa
                                  </button>
                                  <button
                                    onClick={() => updateIncidentStatus(alert.id, 'false_alarm')}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                                  >
                                    <Ban size={14} />
                                    Falso alarme
                                  </button>
                                </>
                              ) : (
                                <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600">
                                  Incidente fechado
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {!alert.resolved && resolveDisabledReason && (
                          <p className="mt-2 text-xs font-medium text-amber-700">
                            {resolveDisabledReason}
                          </p>
                        )}

                        {incidentForAlert && (
                          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-bold text-gray-900">Gestão do incidente</h4>
                                <p className="text-xs text-gray-500">
                                  Estado: {incidentForAlert.status} • Dispatches: {incidentForAlert.responders_dispatched}
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                                {dispatchesForAlert.length} elementos atribuídos
                              </span>
                            </div>

                            {dispatchesForAlert.length === 0 ? (
                              <p className="mt-3 text-sm text-gray-500">
                                Ainda não existe equipa atribuída a este incidente.
                              </p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {dispatchesForAlert.map((dispatch) => {
                                  const status = String(dispatch.status || 'dispatched');
                                  const isCompleted = status === 'completed';
                                  const isDeclined = status === 'declined';
                                  const isFalseAlarm = status === 'false_alarm';
                                  const responderName =
                                    dispatch.incident_metadata?.responder_name ||
                                    `Staff ${dispatch.responder_id}`;

                                  return (
                                    <div
                                      key={dispatch.id ?? `${dispatch.responder_id}-${dispatch.dispatched_at}`}
                                      className={`rounded-xl border px-3 py-2 text-sm ${
                                        isFalseAlarm
                                          ? 'border-slate-300 bg-slate-100'
                                          : isCompleted
                                          ? 'border-emerald-200 bg-emerald-50'
                                          : isDeclined
                                          ? 'border-red-200 bg-red-50'
                                          : 'border-slate-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="font-semibold text-gray-900">{responderName}</p>
                                          <p className="text-xs text-gray-500">
                                            {dispatch.responder_role} • ETA {Math.ceil((dispatch.eta_seconds || 0) / 60)} min
                                          </p>
                                        </div>
                                        <span
                                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                                            isFalseAlarm
                                              ? 'bg-slate-700 text-white'
                                              : isCompleted
                                              ? 'bg-emerald-600 text-white'
                                              : isDeclined
                                              ? 'bg-red-600 text-white'
                                              : status === 'en_route'
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-700'
                                          }`}
                                        >
                                          {isFalseAlarm ? 'Falso alarme' : isCompleted ? 'Concluído' : isDeclined ? 'Recusado' : status}
                                        </span>
                                      </div>

                                      {isFalseAlarm && (
                                        <p className="mt-1 text-xs text-slate-600">
                                          Cancelado pelo supervisor. A equipa atribuída já não precisa de intervir.
                                        </p>
                                      )}

                                      {isCompleted && dispatch.completed_at && (
                                        <p className="mt-1 text-xs text-emerald-700">
                                          Concluído em {new Date(dispatch.completed_at).toLocaleString('pt-PT')}
                                        </p>
                                      )}

                                      {dispatch.incident_metadata?.completion_notes && (
                                        <div className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-xs text-gray-700">
                                          <span className="font-semibold text-gray-900">Relatório:</span>{' '}
                                          {dispatch.incident_metadata.completion_notes}
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {assigningIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Atribuir incidente</h3>
                  <p className="text-sm text-gray-500">
                    {assigningIncident.incident_type} em {assigningIncident.location_node}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAssigningIncident(null);
                    setStaffCandidates([]);
                    setCandidateError('');
                  }}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="px-6 py-5">
                <div className="flex flex-wrap gap-2">
                  {(['security', 'medical', 'cleaning', 'supervisor'] as const).map((department) => (
                    <button
                      key={department}
                      onClick={() => {
                        setSelectedDepartment(department);
                        void loadCandidatesForIncident(assigningIncident, department);
                      }}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        selectedDepartment === department
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {department}
                    </button>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    Disponibilidade baseada nos dispatches ativos. O ETA e a distância são calculados a partir da localização atual do staff até ao nó do incidente.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  {candidateLoading ? (
                    <p className="text-sm text-gray-500">A calcular candidatos e ETA...</p>
                  ) : candidateError ? (
                    <p className="text-sm text-red-600">{candidateError}</p>
                  ) : staffCandidates.length === 0 ? (
                    <p className="text-sm text-gray-500">Sem candidatos para este departamento.</p>
                  ) : (
                    staffCandidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{candidate.name}</p>
                          <p className="text-sm text-gray-500">
                            {candidate.role} • {candidate.location}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span
                              className={`rounded-full px-2 py-1 ${
                                candidate.availability === 'available'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {candidate.availability === 'available' ? 'Disponível' : 'Ocupado'}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                              ETA: {candidate.etaSeconds !== null ? `${Math.ceil(candidate.etaSeconds / 60)} min` : 'N/A'}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                              Distância: {candidate.distance !== null ? `${Math.round(candidate.distance)} m` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => dispatchSpecificCandidate(assigningIncident, candidate)}
                          disabled={
                            isTerminalIncident(assigningIncident) ||
                            candidate.availability !== 'available' ||
                            incidentActionLoading === `dispatch-${assigningIncident.id}-${candidate.id}`
                          }
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Atribuir a este elemento
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
