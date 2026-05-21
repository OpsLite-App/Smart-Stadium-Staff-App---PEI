'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BellRing,
  Building2,
  MapPinned,
  Navigation,
  RefreshCw,
  Route,
  Users,
} from 'lucide-react';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Surface } from '@/components/ui/Surface';
import {
  indoorRoutingService,
  type EdgeOverride,
  type GraphStatus,
  type IndoorRouteGeoJsonResponse,
  type OperationalEvent,
} from '@/lib/services/indoorRouting';
import { api } from '@/lib/services/api';
import { gisApi, type CameraStatus } from '@/lib/services/gisApi';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';

type FloorId = '0' | '1' | '2';
type NotificationLevel = 'info' | 'warning' | 'critical';
type NotificationKind = 'blocked-path' | 'crowd' | 'event' | 'route-impact';

interface CirculationNotification {
  id: string;
  kind: NotificationKind;
  level: NotificationLevel;
  title: string;
  detail: string;
  floorId?: number | null;
  nodeId?: number | null;
  edgeId?: number | null;
  timestamp?: string | null;
}

const FLOOR_OPTIONS = [
  { value: '0', label: 'Piso 0' },
  { value: '1', label: 'Piso 1' },
  { value: '2', label: 'Piso 2' },
];

const notificationStyles: Record<NotificationLevel, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  critical: 'border-red-200 bg-red-50 text-red-900',
};

const notificationBadgeVariant: Record<NotificationLevel, 'default' | 'warning' | 'error'> = {
  info: 'default',
  warning: 'warning',
  critical: 'error',
};

const densityLabels: Record<string, string> = {
  normal: 'normal',
  busy: 'ocupado',
  congested: 'congestionado',
  critical: 'crítico',
};

function getStatusBadgeVariant(status: string) {
  if (status === 'critical') return 'error';
  if (status === 'degraded') return 'warning';
  return 'success';
}

function getEventLevel(event: OperationalEvent): NotificationLevel {
  if (event.severity >= 0.8) return 'critical';
  if (event.severity >= 0.45) return 'warning';
  return 'info';
}

function getCameraLevel(status: CameraStatus): NotificationLevel {
  if (status.density_level === 'critical') return 'critical';
  if (status.density_level === 'congested' || status.density_level === 'busy') return 'warning';
  return 'info';
}

function formatNotificationTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotificationIcon(kind: NotificationKind, level: NotificationLevel) {
  const className = level === 'critical' ? 'text-red-700' : level === 'warning' ? 'text-amber-700' : 'text-blue-700';

  if (kind === 'blocked-path') return <Ban size={18} className={className} />;
  if (kind === 'crowd') return <Users size={18} className={className} />;
  if (kind === 'route-impact') return <Route size={18} className={className} />;
  return <BellRing size={18} className={className} />;
}

export default function MapPage() {
  const [selectedFloor, setSelectedFloor] = useState<FloorId>('1');
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [edgeOverrides, setEdgeOverrides] = useState<EdgeOverride[]>([]);
  const [cameraStatuses, setCameraStatuses] = useState<CameraStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routeRefreshing, setRouteRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<IndoorRouteGeoJsonResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const { active: activeNav, setNavigation } = useNavigationStore();

  const loadMonitoring = async () => {
    try {
      setError(null);
      const [status, liveEvents, overrides] = await Promise.all([
        indoorRoutingService.getGraphStatus(),
        indoorRoutingService.getEvents().catch(() => []),
        indoorRoutingService.getEdgeOverrides().catch(() => []),
      ]);
      setGraphStatus(status);
      setEvents(liveEvents);
      setEdgeOverrides(overrides);
    } catch {
      setError('Não foi possível carregar a monitorização do mapa neste momento.');
    }
  };

  const loadCameraStatuses = async (floor: FloorId) => {
    try {
      const response = await gisApi.getCameraStatus({ floorId: Number(floor) });
      setCameraStatuses(response.statuses ?? []);
    } catch {
      setCameraStatuses([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadMonitoring(), loadCameraStatuses(selectedFloor)]);
      setLoading(false);
    };

    void init();
    const timer = setInterval(() => {
      void loadMonitoring();
      void loadCameraStatuses(selectedFloor);
    }, 20000);

    return () => clearInterval(timer);
  }, [selectedFloor]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveRouteGeometry() {
      if (!activeNav) {
        setRouteGeoJson(null);
        setRouteError(null);
        return;
      }

      const fromNode = Number(activeNav.fromNode);
      const toNode = Number(activeNav.targetNode);

      if (!Number.isFinite(fromNode) || !Number.isFinite(toNode)) {
        setRouteGeoJson(null);
        setRouteError('A rota ativa tem nós pgRouting inválidos.');
        return;
      }

      try {
        setRouteError(null);
        const geoJsonRoute = await indoorRoutingService.getRouteGeoJson(fromNode, toNode);
        if (cancelled) return;

        setRouteGeoJson(geoJsonRoute);
        const firstFloor = geoJsonRoute.summary.floors[0];
        if (firstFloor != null) {
          setSelectedFloor(String(firstFloor) as FloorId);
        }
      } catch {
        if (!cancelled) {
          setRouteGeoJson(null);
          setRouteError('Não foi possível desenhar a rota ativa no mapa.');
        }
      }
    }

    void loadActiveRouteGeometry();

    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadMonitoring(), loadCameraStatuses(selectedFloor)]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRecalculateRoute = async () => {
    if (!activeNav) return;

    try {
      setRouteRefreshing(true);
      const route = await api.getRoute(activeNav.fromNode, activeNav.targetNode);
      const geoJsonRoute = await indoorRoutingService.getRouteGeoJson(
        Number(activeNav.fromNode),
        Number(activeNav.targetNode)
      );
      setNavigation({
        ...activeNav,
        waypoints: route.waypoints.map((waypoint) => ({
          node_id: waypoint.node_id,
          x: waypoint.x,
          y: waypoint.y,
        })),
        etaSeconds: route.eta_seconds,
      });
      setRouteGeoJson(geoJsonRoute);
      await Promise.all([loadMonitoring(), loadCameraStatuses(selectedFloor)]);
    } finally {
      setRouteRefreshing(false);
    }
  };

  const activeEvents = useMemo(
    () => events.filter((event) => event.is_active && event.status === 'active'),
    [events]
  );

  const floorEvents = useMemo(
    () => activeEvents.filter((event) => event.floor_id == null || String(event.floor_id) === selectedFloor),
    [activeEvents, selectedFloor]
  );

  const blockedOverrides = useMemo(
    () => edgeOverrides.filter((override) => override.is_active && override.is_blocked),
    [edgeOverrides]
  );

  const crowdCameraStatuses = useMemo(
    () => cameraStatuses.filter((status) => ['busy', 'congested', 'critical'].includes(status.density_level)),
    [cameraStatuses]
  );

  const routeImpactedEdgeIds = useMemo(
    () => new Set(routeGeoJson?.summary.impacted_edges ?? []),
    [routeGeoJson]
  );

  const circulationNotifications = useMemo<CirculationNotification[]>(() => {
    const notifications: CirculationNotification[] = [];

    blockedOverrides.forEach((override) => {
      notifications.push({
        id: `blocked-${override.edge_id}`,
        kind: 'blocked-path',
        level: 'critical',
        title: 'Corredor fechado',
        detail: override.reason || `Aresta ${override.edge_id} bloqueada para circulação.`,
        edgeId: override.edge_id,
        timestamp: override.starts_at,
      });
    });

    crowdCameraStatuses.forEach((status) => {
      const level = getCameraLevel(status);
      notifications.push({
        id: `camera-${status.camera_id}`,
        kind: 'crowd',
        level,
        title: level === 'critical' ? 'Aglomerado crítico de pessoas' : 'Aglomerado de pessoas',
        detail: `${status.monitored_area || status.camera_name || `Câmara ${status.camera_id}`} · ${status.people_count} pessoas · ${densityLabels[status.density_level] ?? status.density_level}`,
        floorId: status.floor_id,
        timestamp: status.timestamp,
      });
    });

    floorEvents.forEach((event) => {
      notifications.push({
        id: `event-${event.id}`,
        kind: 'event',
        level: getEventLevel(event),
        title: event.title || 'Evento operacional',
        detail: event.description || event.source || 'Evento ativo com impacto potencial na circulação.',
        floorId: event.floor_id,
        nodeId: event.node_id,
        edgeId: event.edge_id,
        timestamp: event.starts_at,
      });
    });

    if (routeGeoJson && routeGeoJson.summary.impacted_edge_count > 0) {
      notifications.unshift({
        id: 'route-impact',
        kind: 'route-impact',
        level: 'warning',
        title: 'Rota ativa afetada',
        detail: `${routeGeoJson.summary.impacted_edge_count} segmento(s) da rota têm bloqueios ou custos aumentados.`,
      });
    }

    const levelWeight: Record<NotificationLevel, number> = { critical: 3, warning: 2, info: 1 };
    return notifications.sort((a, b) => levelWeight[b.level] - levelWeight[a.level]);
  }, [blockedOverrides, crowdCameraStatuses, floorEvents, routeGeoJson]);

  const routeAffected = Boolean(
    routeGeoJson?.summary.impacted_edge_count ||
      blockedOverrides.some((override) => routeImpactedEdgeIds.has(override.edge_id))
  );

  const criticalCount = circulationNotifications.filter((item) => item.level === 'critical').length;
  const warningCount = circulationNotifications.filter((item) => item.level === 'warning').length;
  const statusVariant = getStatusBadgeVariant(graphStatus?.status ?? 'healthy');

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <Surface className="border border-gray-200 p-5 md:p-6" elevation="sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Mapa indoor</h2>
                <p className="text-sm text-gray-500">Dados reais de PostGIS + estado operacional do routing.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SegmentedControl
                options={FLOOR_OPTIONS}
                defaultValue={selectedFloor}
                onChange={(value) => setSelectedFloor(value as FloorId)}
              />
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-[2rem] border border-gray-200 bg-[radial-gradient(circle_at_top,#f8fafc,#eef2ff)] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Piso selecionado</p>
                <h3 className="mt-1 text-2xl font-semibold text-gray-900">Piso {selectedFloor}</h3>
              </div>
              <Badge variant={statusVariant} rounded>
                {graphStatus?.status ?? 'a carregar'}
              </Badge>
            </div>

            {activeNav && (
              <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Rota ativa: {activeNav.binName}</p>
                    <p className="text-blue-700">
                      Nó {activeNav.fromNode} → Nó {activeNav.targetNode}
                      {routeGeoJson
                        ? ` · ${Math.round(routeGeoJson.summary.distance)} m · ${Math.round(routeGeoJson.summary.eta_seconds / 60)} min`
                        : ''}
                    </p>
                  </div>
                  {routeGeoJson?.summary.uses_vertical_transition && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                      mudança de piso
                    </span>
                  )}
                </div>
                {routeError && <p className="mt-2 text-sm text-red-700">{routeError}</p>}
              </div>
            )}

            <IndoorGisMap
              floorId={Number(selectedFloor)}
              routeGeoJson={routeGeoJson?.route ?? null}
              routeAffected={routeAffected}
            />
          </div>
        </Surface>

        <div className="space-y-6">
          <Surface className="border border-gray-200 p-5" elevation="sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <BellRing size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Notificações de circulação</h3>
                  <p className="text-sm text-gray-500">Apenas eventos com impacto no movimento.</p>
                </div>
              </div>
              <Badge variant={criticalCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success'} rounded>
                {loading ? 'a carregar' : `${circulationNotifications.length} ativas`}
              </Badge>
            </div>

            {circulationNotifications.length > 0 ? (
              <div className="space-y-3">
                {circulationNotifications.map((notification) => {
                  const timeLabel = formatNotificationTime(notification.timestamp);

                  return (
                    <div
                      key={notification.id}
                      className={`rounded-2xl border px-4 py-3 shadow-sm ${notificationStyles[notification.level]}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70">
                          {getNotificationIcon(notification.kind, notification.level)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{notification.title}</p>
                            <Badge variant={notificationBadgeVariant[notification.level]} rounded>
                              {notification.level === 'critical' ? 'crítico' : notification.level === 'warning' ? 'atenção' : 'info'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm opacity-85">{notification.detail}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-75">
                            {notification.floorId != null && <span>Piso {notification.floorId}</span>}
                            {notification.nodeId != null && <span>Nó {notification.nodeId}</span>}
                            {notification.edgeId != null && <span>Corredor {notification.edgeId}</span>}
                            {timeLabel && <span>{timeLabel}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Navigation size={17} />
                  Circulação normal neste piso
                </div>
                Não há corredores fechados nem aglomerados relevantes detetados pelas câmaras.
              </div>
            )}
          </Surface>

          <Surface className="border border-gray-200 p-5" elevation="sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <MapPinned size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Impacto na rota</h3>
                <p className="text-sm text-gray-500">Só aparece ação quando existe rota ativa.</p>
              </div>
            </div>

            {activeNav ? (
              <div className="space-y-4">
                <div className={`rounded-2xl border px-4 py-3 text-sm ${routeAffected ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                  {routeAffected
                    ? 'A rota ativa pode ser afetada por bloqueios ou custos operacionais.'
                    : 'A rota ativa não tem impacto operacional conhecido.'}
                </div>
                <button
                  type="button"
                  onClick={() => void handleRecalculateRoute()}
                  disabled={routeRefreshing}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {routeRefreshing ? 'A recalcular...' : 'Recalcular rota'}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                Não existe uma rota ativa neste momento.
              </div>
            )}
          </Surface>

          <Surface className="border border-gray-200 p-5" elevation="sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Resumo técnico</h3>
                <p className="text-sm text-gray-500">Estado global do grafo de circulação.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Arestas bloqueadas</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{graphStatus?.blocked_edges ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Alertas ativos</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{graphStatus?.active_alerts ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Aglomerados</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{crowdCameraStatuses.length}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Atualizado</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {graphStatus?.updated_at ? new Date(graphStatus.updated_at).toLocaleTimeString('pt-PT') : 'sem dados'}
                </p>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
