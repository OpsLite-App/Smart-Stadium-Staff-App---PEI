// app/app-routes/alerts/page.tsx
'use client';
import { Client } from '@stomp/stompjs';
import { WS_GATEWAY } from '@/lib/services/api';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { CONGESTION_SERVICE, EMERGENCY_SERVICE } from '@/lib/services/api';
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
}

interface ActiveDispatchEntry {
  responder_id: string;
  responder_role: string;
  eta_seconds: number;
  status: string;
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

function normalizeCongestionAlert(raw: Record<string, unknown>): Alert {
  const occupancy = typeof raw.occupancy_rate === 'number' ? raw.occupancy_rate : 0;
  const capacity = typeof raw.capacity === 'number' ? raw.capacity : undefined;
  const currentCount = typeof raw.current_count === 'number' ? raw.current_count : undefined;
  const areaId = typeof raw.area_id === 'string' ? raw.area_id : 'Área desconhecida';
  const areaType = typeof raw.area_type === 'string' ? raw.area_type : 'unknown';
  const severity = normalizeSeverity(raw.severity ?? (occupancy >= 95 ? 'critical' : occupancy >= 80 ? 'high' : 'medium'));

  return {
    id: String(raw.id ?? `congestion-${areaId}`),
    type: 'crowd',
    severity,
    title: 'Alta concentração de pessoas',
    description:
      currentCount !== undefined && capacity !== undefined
        ? `Ocupação ${occupancy.toFixed(1)}% (${currentCount}/${capacity} pessoas).`
        : `Ocupação ${occupancy.toFixed(1)}%.`,
    location: areaId,
    location_details: {
      node_id: areaId,
      area: areaType,
      coordinates:
        typeof raw.latitude === 'number' && typeof raw.longitude === 'number'
          ? { lat: raw.latitude, lng: raw.longitude }
          : undefined,
    },
    timestamp: safeTimestamp(raw.last_update ?? raw.timestamp),
    read: false,
    acknowledged: false,
    resolved: false,
    source: 'api',
    metadata: {
      occupancy_rate: occupancy,
      area_type: areaType,
      current_count: currentCount,
      capacity,
      heat_level: raw.heat_level,
    },
  };
}

function normalizeAlertsFromSource(sourceName: string, payload: unknown): Alert[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) =>
      sourceName === 'Emergency Service'
        ? normalizeEmergencyAlert(item)
        : normalizeCongestionAlert(item)
    );
}

function normalizeRealtimeAlert(topic: string, raw: unknown): Alert | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Record<string, unknown>;
  const eventType = typeof payload.event_type === 'string' ? payload.event_type : '';

  if (topic.includes('/crowd')) {
    if (eventType !== 'crowd_density') return null;
    return normalizeCongestionAlert({
      ...payload,
      area_type: payload.area_type ?? 'gate',
      current_count: payload.current_count ?? 0,
      capacity: payload.capacity ?? 100,
      last_update: payload.timestamp ?? new Date().toISOString(),
      latitude:
        payload.location &&
        typeof payload.location === 'object' &&
        typeof (payload.location as Record<string, unknown>).x === 'number'
          ? (payload.location as Record<string, number>).x
          : undefined,
      longitude:
        payload.location &&
        typeof payload.location === 'object' &&
        typeof (payload.location as Record<string, unknown>).y === 'number'
          ? (payload.location as Record<string, number>).y
          : undefined,
    });
  }

  if (topic.includes('/emergency')) {
    if (eventType !== 'sos_event' && eventType !== 'sensor_alert') return null;
    return normalizeEmergencyAlert({
      id: payload.event_id ?? payload.id,
      incident_id: payload.incident_id,
      sensor_type: payload.sensor_type ?? payload.details ?? 'emergência',
      reading_value: payload.reading_value,
      threshold: payload.threshold,
      unit: payload.unit,
      status: payload.status ?? 'active',
      location_node: payload.location_node,
      detected_at: payload.timestamp ?? new Date().toISOString(),
      severity: payload.priority ?? payload.severity ?? 'high',
      incident_metadata: payload.metadata ?? {},
    });
  }

  return null;
}

export default function AlertsPage() {
  const { user } = useAuthStore();
  const isSupervisor = user?.role === 'Supervisor';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<EmergencyIncidentAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incidentActionLoading, setIncidentActionLoading] = useState<string | null>(null);
  const [incidentForm, setIncidentForm] = useState({
    incident_type: 'medical',
    location_node: 'N1',
    severity: 'medium',
    description: '',
  });
  const [assigningIncident, setAssigningIncident] = useState<EmergencyIncidentAdmin | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<'security' | 'cleaning' | 'supervisor' | 'medical'>('security');
  const [staffCandidates, setStaffCandidates] = useState<StaffCandidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState('');
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

  // Load alerts from API
  const fetchAlerts = async () => {
    try {
      setRefreshing(true);
      console.log('🔍 Fetching alerts...');

      // Try fetching from multiple sources
      const sources = [
        {
          name: 'Congestion Service',
          urls: [`${CONGESTION_SERVICE}/alerts`],
        },
        {
          name: 'Emergency Service',
          urls: [`${EMERGENCY_SERVICE}/sensors/alerts`],
        },
      ];

      let allAlerts: Alert[] = [];
      for (const source of sources) {
        let sourceSuccess = false;

        for (const url of source.urls) {
          try {
            console.log(`📡 Trying ${source.name}: ${url}...`);
            const response = await axios.get(url, { timeout: 3000 });

            if (response.data && Array.isArray(response.data)) {
              const normalized = normalizeAlertsFromSource(source.name, response.data);
              console.log(`✅ ${source.name}: ${normalized.length} alerts`);
              allAlerts = [...allAlerts, ...normalized];
              sourceSuccess = true;
              break;
            }

            if (response.data && response.data.alerts) {
              const rawAlerts = (response.data as { alerts: unknown[] }).alerts;
              const normalized = normalizeAlertsFromSource(source.name, rawAlerts);
              console.log(`✅ ${source.name}: ${normalized.length} alerts`);
              allAlerts = [...allAlerts, ...normalized];
              sourceSuccess = true;
              break;
            }
          } catch {
            // try next endpoint
          }
        }

        if (!sourceSuccess) {
          console.warn(`⚠️ ${source.name} unavailable`);
        }
      }

      if (allAlerts.length === 0) {
        console.log('ℹ️ No active alerts from services');
      }

      if (isSupervisor) {
        try {
          const incidentResponse = await axios.get<{ incidents?: EmergencyIncidentAdmin[] }>(
            `${EMERGENCY_SERVICE}/incidents`,
            { timeout: 3000 }
          );
          setIncidents(incidentResponse.data?.incidents || []);
        } catch {
          setIncidents([]);
        }
      }

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

  // Load alerts on component mount
  useEffect(() => {
    fetchAlerts();

    // WebSocket for real-time alerts
    // STOMP WebSocket for real-time alerts
    const client = new Client({
      brokerURL: WS_GATEWAY,
      connectHeaders: user?.token
        ? { Authorization: `Bearer ${user.token}` }
        : {},

      debug: (str) => {
        console.log('STOMP:', str);
      },

      onConnect: () => {
        console.log('✅ STOMP connected (alerts)');

        client.subscribe('/topic/crowd', (msg) => {
          try {
            const payload = JSON.parse(msg.body) as unknown;
            const newAlert = normalizeRealtimeAlert('/topic/crowd', payload);
            if (!newAlert) return;

            setAlerts(prev => {
              const exists = prev.some(a => a.id === newAlert.id);
              if (exists) return prev;

              const updated = [newAlert, ...prev];
              calculateStats(updated);
              return updated;
            });

          } catch (e) {
            console.error('Error processing crowd alert:', e);
          }
        });

        client.subscribe('/topic/emergency', (msg) => {
          try {
            const payload = JSON.parse(msg.body) as unknown;
            const newAlert = normalizeRealtimeAlert('/topic/emergency', payload);
            if (!newAlert) return;

            setAlerts(prev => {
              const exists = prev.some(a => a.id === newAlert.id);
              if (exists) return prev;

              const updated = [newAlert, ...prev];
              calculateStats(updated);
              return updated;
            });

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
    const interval = setInterval(fetchAlerts, 30000);

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
      // Try sending acknowledgment to API
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Alert acknowledged (dev mode):', alertId);
      } else {
        await axios.post(`${CONGESTION_SERVICE}/alerts/${alertId}/acknowledge`, {
          user_id: user.id,
          user_name: user.email?.split('@')[0] || 'Staff'
        });
      }

      // Update locally
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
      
      // Fallback: still update locally
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

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    if (!user) return;
    const resolvedAt = new Date().toISOString();

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Alert resolved (dev mode):', alertId);
      } else {
        await axios.post(`${CONGESTION_SERVICE}/alerts/${alertId}/resolve`, {
          user_id: user.id,
          resolved_at: resolvedAt
        });
      }

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
      
      // Fallback
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
    }
  };

  const createIncident = async () => {
    if (!user?.permissions.canCreateIncidents) return;

    try {
      setIncidentActionLoading('create');
      await axios.post(`${EMERGENCY_SERVICE}/incidents`, {
        incident_type: incidentForm.incident_type,
        location_node: incidentForm.location_node,
        severity: incidentForm.severity,
        description: incidentForm.description || undefined,
        detected_by: 'staff',
        reported_by: String(user.id || user.email),
        incident_metadata: {
          created_from: 'supervisor_alerts_page',
        },
      });

      setIncidentForm({
        incident_type: 'medical',
        location_node: 'N1',
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
        axios.get<StaffApiEntry[]>(`/api/auth/staff`, { timeout: 4000 }),
        axios.get<ActiveDispatchEntry[]>(`${EMERGENCY_SERVICE}/dispatch/active`, { timeout: 4000 }).catch(() => ({ data: [] })),
      ]);

      const roleMatchers: Record<typeof department, string[]> = {
        security: ['security'],
        cleaning: ['cleaning', 'maintenance'],
        supervisor: ['supervisor'],
        medical: ['medical', 'medic'],
      };

      const busyIds = new Set((activeDispatchesResponse.data || []).map((item) => String(item.responder_id)));

      const filteredStaff = (staffResponse.data || []).filter((member) =>
        roleMatchers[department].some((role) => String(member.role || '').toLowerCase().includes(role))
      );

      const candidatesWithEta = await Promise.all(
        filteredStaff.map(async (member) => {
          const location = member.location || 'N1';
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

    try {
      setIncidentActionLoading(`dispatch-${incident.id}-${candidate.id}`);
      await axios.post(`${EMERGENCY_SERVICE}/dispatch/manual`, {
        incident_id: incident.id,
        responder_id: candidate.id,
        responder_role: selectedDepartment,
        current_position: candidate.location,
        responder_name: candidate.name,
      });
      setAssigningIncident(null);
      setStaffCandidates([]);
      await fetchAlerts();
    } catch (error) {
      console.error('Error dispatching specific candidate:', error);
    } finally {
      setIncidentActionLoading(null);
    }
  };

  const updateIncidentStatus = async (incidentId: string, status: string) => {
    if (!user?.permissions.canManageIncidents) return;

    try {
      setIncidentActionLoading(`${status}-${incidentId}`);
      await axios.patch(`${EMERGENCY_SERVICE}/incidents/${incidentId}`, {
        status,
        notes: `Atualizado por supervisor ${user.email}`,
      });
      await fetchAlerts();
    } catch (error) {
      console.error('Error updating incident:', error);
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
        {isSupervisor && (
          <div className="mb-6 grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
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

                <input
                  value={incidentForm.location_node}
                  onChange={(e) => setIncidentForm((prev) => ({ ...prev, location_node: e.target.value }))}
                  placeholder="Nó da ocorrência"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                />

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

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Gestão manual de incidentes</h2>
                  <p className="text-sm text-gray-500">Dispatch, resolução e falso alarme</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {incidents.filter((incident) => incident.status !== 'resolved' && incident.status !== 'false_alarm').length} ativos
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {incidents.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem incidentes carregados.</p>
                ) : (
                  incidents.map((incident) => (
                    <div key={incident.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {incident.incident_type} • {incident.location_node}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">{incident.description || 'Sem descrição adicional.'}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-700">{incident.status}</span>
                            <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-700">{incident.severity}</span>
                            <span className="rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-700">
                              Dispatches: {incident.responders_dispatched}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openAssignModal(incident)}
                            disabled={incidentActionLoading?.startsWith(`dispatch-${incident.id}`)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Atribuir
                          </button>

                          <button
                            onClick={() => updateIncidentStatus(incident.id, 'resolved')}
                            disabled={incidentActionLoading === `resolved-${incident.id}`}
                            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Resolver
                          </button>

                          <button
                            onClick={() => updateIncidentStatus(incident.id, 'false_alarm')}
                            disabled={incidentActionLoading === `false_alarm-${incident.id}`}
                            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                          >
                            False alarm
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                          
                          {!alert.acknowledged && (user?.role === 'Security' || user?.role === 'Supervisor') && (
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
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                            >
                              <CheckCircle size={14} />
                              Marcar como resolvido
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
                      onClick={() => setSelectedDepartment(department)}
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
