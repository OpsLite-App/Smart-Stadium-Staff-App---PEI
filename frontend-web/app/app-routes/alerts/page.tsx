// app/app-routes/alerts/page.tsx
'use client';
import { Client } from '@stomp/stompjs';
import { WS_GATEWAY } from '@/lib/services/api';
import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
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

  const completedCount = Math.max(0, stats.total - stats.unresolved);

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
