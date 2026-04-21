'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  MapPinned,
  RefreshCw,
  Route,
  ShieldAlert,
  Waves,
} from 'lucide-react';
import { AlertsPanel } from '@/components/navigation/AlertsPanel';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Surface } from '@/components/ui/Surface';
import { FLOOR_ZONES, getEdgesForZone, type FloorId, type FloorZone } from '@/lib/config/indoorGraph';
import { indoorRoutingService, type EdgeOverride, type GraphStatus, type OperationalEvent } from '@/lib/services/indoorRouting';
import { useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api } from '@/lib/services/api';

type ZoneLevel = 'green' | 'yellow' | 'red';
type ZoneStatus = 'normal' | 'warning' | 'critical';

interface ResolvedZone extends FloorZone {
  status: ZoneStatus;
  level: ZoneLevel;
  description: string;
  alertCount: number;
  blockedCount: number;
  routeActive: boolean;
}

const FLOOR_OPTIONS = [
  { value: '1', label: 'Floor 1' },
  { value: '2', label: 'Floor 2' },
];

const levelStyles: Record<ZoneLevel, string> = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  yellow: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-800',
};

const zoneStatusStyles: Record<ZoneStatus, string> = {
  normal: 'border-emerald-200 bg-emerald-50/95 text-emerald-800 shadow-emerald-100',
  warning: 'border-amber-200 bg-amber-50/95 text-amber-800 shadow-amber-100',
  critical: 'border-red-200 bg-red-50/95 text-red-800 shadow-red-100',
};

function zoneStatusToLevel(status: ZoneStatus): ZoneLevel {
  if (status === 'critical') return 'red';
  if (status === 'warning') return 'yellow';
  return 'green';
}

function getStatusBadgeVariant(status: string) {
  if (status === 'critical') return 'error';
  if (status === 'degraded') return 'warning';
  return 'success';
}

function getZoneStatus(
  zone: FloorZone,
  events: OperationalEvent[],
  overrides: EdgeOverride[],
  graphStatus: GraphStatus | null
): ZoneStatus {
  const zoneEdgeIds = new Set(getEdgesForZone(zone).map((edge) => edge.id));
  const affectingEvents = events.filter(
    (event) =>
      event.is_active &&
      event.status === 'active' &&
      (
        (event.node_id != null && zone.nodeIds.includes(event.node_id)) ||
        (event.edge_id != null && zoneEdgeIds.has(event.edge_id))
      )
  );
  const affectingOverrides = overrides.filter(
    (override) => override.is_active && zoneEdgeIds.has(override.edge_id)
  );

  if (affectingEvents.some((event) => event.severity >= 0.8)) {
    return 'critical';
  }

  if (
    affectingEvents.length > 0 ||
    affectingOverrides.length > 0 ||
    (graphStatus?.status != null && graphStatus.status !== 'healthy')
  ) {
    return 'warning';
  }

  return 'normal';
}

function getZoneDescription(
  zone: FloorZone,
  status: ZoneStatus,
  events: OperationalEvent[],
  overrides: EdgeOverride[]
) {
  const zoneEdgeIds = new Set(getEdgesForZone(zone).map((edge) => edge.id));
  const affectingEvents = events.filter(
    (event) =>
      event.is_active &&
      event.status === 'active' &&
      (
        (event.node_id != null && zone.nodeIds.includes(event.node_id)) ||
        (event.edge_id != null && zoneEdgeIds.has(event.edge_id))
      )
  );
  const blockedOverrides = overrides.filter(
    (override) => override.is_active && override.is_blocked && zoneEdgeIds.has(override.edge_id)
  );

  const alertsCount = affectingEvents.length;
  const blockedCount = blockedOverrides.length;

  if (status === 'critical') {
    const severeEvent = affectingEvents.find((event) => event.severity >= 0.8);
    return severeEvent?.title
      ? `${zone.name} - critical: ${severeEvent.title}`
      : `${zone.name} - critical live condition detected`;
  }

  if (status === 'warning') {
    const parts: string[] = [];
    if (alertsCount > 0) {
      parts.push(`${alertsCount} alert${alertsCount > 1 ? 's' : ''}`);
    }
    if (blockedCount > 0) {
      parts.push(`${blockedCount} blocked path${blockedCount > 1 ? 's' : ''}`);
    }
    return parts.length > 0 ? `${zone.name} - ${parts.join(', ')}` : `${zone.name} - live conditions require attention`;
  }

  return `${zone.name} - normal monitored movement`;
}

export default function MapPage() {
  const [selectedFloor, setSelectedFloor] = useState<FloorId>('1');
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [edgeOverrides, setEdgeOverrides] = useState<EdgeOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routeRefreshing, setRouteRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Unable to load IT building monitoring data right now.');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadMonitoring();
      setLoading(false);
    };

    void init();
    const timer = setInterval(() => {
      void loadMonitoring();
    }, 20000);

    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadMonitoring();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRecalculateRoute = async () => {
    if (!activeNav) return;

    try {
      setRouteRefreshing(true);
      const route = await api.getRoute(activeNav.fromNode, activeNav.targetNode);
      setNavigation({
        ...activeNav,
        waypoints: route.waypoints.map((waypoint) => ({
          node_id: waypoint.node_id,
          x: waypoint.x,
          y: waypoint.y,
        })),
        etaSeconds: route.eta_seconds,
      });
      await loadMonitoring();
    } finally {
      setRouteRefreshing(false);
    }
  };

  const activeEvents = useMemo(
    () => events.filter((event) => event.is_active && event.status === 'active'),
    [events]
  );

  const blockedOverrides = useMemo(
    () => edgeOverrides.filter((override) => override.is_active && override.is_blocked),
    [edgeOverrides]
  );

  const activeRouteNodeIds = useMemo(
    () => new Set(activeNav?.waypoints.map((waypoint) => waypoint.node_id) ?? []),
    [activeNav]
  );

  const visibleZones = useMemo<ResolvedZone[]>(() => {
    return FLOOR_ZONES[selectedFloor].map((zone) => {
      const status = getZoneStatus(zone, activeEvents, blockedOverrides, graphStatus);
      const zoneEdges = getEdgesForZone(zone);
      const zoneEdgeIds = new Set(zoneEdges.map((edge) => edge.id));
      const zoneEvents = activeEvents.filter(
        (event) =>
          (event.node_id != null && zone.nodeIds.includes(event.node_id)) ||
          (event.edge_id != null && zoneEdgeIds.has(event.edge_id))
      );
      const zoneBlockedOverrides = blockedOverrides.filter((override) => zoneEdgeIds.has(override.edge_id));
      const routeActive = zone.nodeIds.some((nodeId) => activeRouteNodeIds.has(nodeId));

      return {
        ...zone,
        status,
        level: zoneStatusToLevel(status),
        description: getZoneDescription(zone, status, activeEvents, blockedOverrides),
        alertCount: zoneEvents.length,
        blockedCount: zoneBlockedOverrides.length,
        routeActive,
      };
    });
  }, [activeEvents, activeRouteNodeIds, blockedOverrides, graphStatus, selectedFloor]);

  const routeAffected = Boolean(
    graphStatus?.status !== 'healthy' ||
      blockedOverrides.length > 0 ||
      activeEvents.length > 0
  );

  const statusVariant = getStatusBadgeVariant(graphStatus?.status ?? 'healthy');

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div className="rounded-[2rem] bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-blue-100">IT Building Monitoring</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Indoor Operations Map</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100 md:text-base">
              Live staff awareness for the IT building: monitor floor conditions, blocked paths,
              operational alerts, and route impact from the routing backend.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-blue-100">Graph status</p>
              <p className="mt-2 text-lg font-semibold capitalize">{graphStatus?.status ?? 'loading'}</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-blue-100">Blocked paths</p>
              <p className="mt-2 text-lg font-semibold">{graphStatus?.blocked_edges ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-blue-100">Active alerts</p>
              <p className="mt-2 text-lg font-semibold">{graphStatus?.active_alerts ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-blue-100">Overrides</p>
              <p className="mt-2 text-lg font-semibold">{graphStatus?.cost_overrides ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-6">
          <Surface className="border border-gray-200 p-5 md:p-6" elevation="sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Building Floors</h2>
                    <p className="text-sm text-gray-500">
                      Structured indoor zones with relative positioning, ready for future GIS upgrades.
                    </p>
                  </div>
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
                  Refresh
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
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Selected floor</p>
                  <h3 className="mt-1 text-2xl font-semibold text-gray-900">Floor {selectedFloor}</h3>
                </div>
                <Badge variant={statusVariant} rounded>
                  {graphStatus?.status ?? 'loading'}
                </Badge>
              </div>

              <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(160deg,#ffffff,#f8fafc)] p-4 md:p-6">
                <div className="pointer-events-none absolute inset-0 opacity-70">
                  <div className="absolute left-[8%] top-[18%] h-[32%] w-[28%] rounded-[2rem] border border-slate-200/80 bg-white/70" />
                  <div className="absolute left-[38%] top-[12%] h-[52%] w-[24%] rounded-[2rem] border border-slate-200/80 bg-white/70" />
                  <div className="absolute left-[67%] top-[20%] h-[30%] w-[22%] rounded-[2rem] border border-slate-200/80 bg-white/70" />
                  <div className="absolute left-[24%] top-[68%] h-[16%] w-[54%] rounded-[999px] border border-dashed border-slate-300/90 bg-slate-100/60" />
                </div>

                <div className="relative h-[24rem] rounded-[1.5rem] border border-dashed border-slate-300/80 bg-[radial-gradient(circle_at_top,#eff6ff,#f8fafc)]">
                  {visibleZones.map((zone) => (
                    <div
                      key={zone.id}
                      className="group absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                    >
                      <div
                        title={`${zone.name} - ${zone.description}`}
                        className={`min-w-[9rem] rounded-2xl border px-3 py-2 shadow-lg transition-transform duration-200 group-hover:-translate-y-1 ${zoneStatusStyles[zone.status]} ${zone.routeActive ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-3.5 w-3.5 rounded-full ${
                              zone.status === 'normal'
                                ? 'bg-emerald-500'
                                : zone.status === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          <p className="text-xs font-semibold uppercase tracking-wide">
                            {zone.name}
                          </p>
                        </div>
                        <p className="mt-2 text-xs opacity-90">{zone.description}</p>
                        {zone.routeActive && (
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                            Active route
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                {visibleZones.map((zone) => (
                  <div key={zone.id} className={`rounded-3xl border p-4 shadow-sm ${levelStyles[zone.level]}`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{zone.name}</p>
                        <p className="mt-1 text-xs opacity-80">{zone.description}</p>
                      </div>
                      <span className="h-4 w-4 rounded-full border border-white/60 bg-current opacity-90" />
                    </div>
                    <p className="text-xs opacity-85">
                      {zone.alertCount} active alert{zone.alertCount !== 1 ? 's' : ''} · {zone.blockedCount} blocked path{zone.blockedCount !== 1 ? 's' : ''}
                    </p>
                    <div className="mt-4 grid grid-cols-6 gap-1">
                      {Array.from({ length: 18 }).map((_, index) => (
                        <div
                          key={`${zone.id}-${index}`}
                          className={`h-3 rounded-full ${
                            zone.level === 'green'
                              ? 'bg-emerald-400/70'
                              : zone.level === 'yellow'
                                ? 'bg-amber-400/80'
                                : 'bg-red-400/85'
                          } ${index % 5 === 0 ? 'opacity-100' : 'opacity-70'}`}
                        />
                      ))}
                    </div>
                    <p className="mt-4 text-xs font-medium uppercase tracking-wide opacity-80">
                      {zone.status === 'critical'
                        ? 'Critical zone'
                        : zone.status === 'warning'
                          ? 'Congestion warning'
                          : 'Baseline floor status'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <Waves size={16} />
                    Normal
                  </div>
                  Green zones indicate regular monitored movement.
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <Activity size={16} />
                    Congested
                  </div>
                  Yellow zones indicate notable pressure or crowd growth.
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <ShieldAlert size={16} />
                    Critical
                  </div>
                  Red zones indicate blocked paths or severe operational alerts.
                </div>
              </div>
            </div>
          </Surface>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Surface className="border border-gray-200 p-5" elevation="sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Route size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Blocked Paths</h3>
                  <p className="text-sm text-gray-500">Current routing restrictions.</p>
                </div>
              </div>
              {blockedOverrides.length > 0 ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Some paths are currently blocked. Routes may be affected.
                  </div>
                  <p className="text-sm text-gray-600">
                    Blocked paths: {blockedOverrides.map((override) => override.edge_id).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  No blocked paths right now.
                </div>
              )}
            </Surface>

            <Surface className="border border-gray-200 p-5" elevation="sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <MapPinned size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Floor Monitoring</h3>
                  <p className="text-sm text-gray-500">Conditions emphasized on Floor {selectedFloor}.</p>
                </div>
              </div>
              <div className="space-y-3">
                {visibleZones.map((zone) => (
                  <div key={`summary-${zone.id}`} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{zone.name}</p>
                      <p className="text-sm text-gray-500">{zone.description}</p>
                    </div>
                    <Badge variant={zone.level === 'red' ? 'error' : zone.level === 'yellow' ? 'warning' : 'success'} rounded>
                      {zone.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="border border-gray-200 p-5" elevation="sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Route Impact</h3>
                  <p className="text-sm text-gray-500">Awareness for ongoing staff navigation.</p>
                </div>
              </div>

              {routeAffected ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Current route may be affected by live conditions.
                  </div>
                  {activeNav ? (
                    <button
                      type="button"
                      onClick={() => void handleRecalculateRoute()}
                      disabled={routeRefreshing}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {routeRefreshing ? 'Recalculating...' : 'Recalculate Route'}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No route context is currently active on this screen.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  Routes are not currently impacted by live conditions.
                </div>
              )}
            </Surface>
          </div>
        </div>

        <div className="space-y-6">
          <AlertsPanel
            events={activeEvents.filter((event) => event.floor_id == null || String(event.floor_id) === selectedFloor)}
            loading={loading}
          />

          <Surface className="border border-gray-200 p-5" elevation="sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Operational Snapshot</h3>
                <p className="text-sm text-gray-500">Quick health summary for the selected floor.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Graph status</p>
                <p className="mt-1 text-lg font-semibold capitalize text-gray-900">{graphStatus?.status ?? 'loading'}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Blocked edges</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{graphStatus?.blocked_edges ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Active alerts</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{graphStatus?.active_alerts ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Updated</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {graphStatus?.updated_at ? new Date(graphStatus.updated_at).toLocaleString('pt-PT') : 'No data'}
                </p>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
