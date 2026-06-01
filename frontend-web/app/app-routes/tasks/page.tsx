'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { RouteWaypoint, useNavigationStore } from '@/lib/stores/useNavigationStore';
import { api, EMERGENCY_EVENTS_URL, EMERGENCY_SERVICE } from '@/lib/services/api';
import { gisApi } from '@/lib/services/gisApi';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import { getRouteStartFloor, indoorRoutingService, type IndoorRouteGeoJsonResponse } from '@/lib/services/indoorRouting';
import axios from 'axios';
import { Ban, CheckCircle, Clock, MapPin, RefreshCw, AlertTriangle, X, ThumbsUp, ClipboardList, Trash2, Search, Check } from 'lucide-react';

interface MaintenanceTask {
  id: string;
  task_type: string;
  location_node: string;
  priority: string;
  status: string;
  description?: string;
  assigned_to?: string;
  main_metadata?: { bin_id?: string; fill_percentage?: number };
  created_at?: string;
}

interface IncidentDispatch {
  id: string;
  incident_id: string;
  responder_id: string;
  responder_role: string;
  route_nodes: string[];
  route_distance: number;
  eta_seconds: number;
  status: string;
  dispatched_at: string;
  incident_type?: string;
  incident_location?: string;
  incident_severity?: string;
  incident_description?: string | null;
}

interface IncidentSummary {
  id: string;
  incident_type?: string;
  location_node?: string;
  severity?: string;
  description?: string | null;
  location_description?: string | null;
}

type TaskLocalStatus = 'pending' | 'accepted' | 'refused' | 'done';
type CompletionTarget = {
  kind: 'dispatch' | 'task';
  id: string;
  title: string;
} | null;

interface NearestTaskInfo {
  id: string;
  type: 'bin' | 'dispatch';
  title: string;
  node: string;
  distance: number;
  etaSeconds: number;
  originalItem: any;
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

function getDefaultStartNode(role?: string) {
  const normalizedRole = String(role ?? '').toLowerCase();
  if (normalizedRole.includes('clean')) return '62';
  if (normalizedRole.includes('medic')) return '1';
  if (normalizedRole.includes('security')) return '66';
  return '62';
}

function isAcceptedStatus(status?: string) {
  return ['in_progress', 'en_route', 'arrived'].includes(String(status ?? '').toLowerCase());
}

function isFalseAlarmStatus(status?: string) {
  return String(status ?? '').toLowerCase() === 'false_alarm';
}

function getDispatchTarget(dispatch: IncidentDispatch) {
  if (dispatch.incident_location && dispatch.incident_location !== '?') return dispatch.incident_location;
  return dispatch.route_nodes.at(-1) ?? '62';
}

export default function TasksPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { active: activeNavigation, setNavigation, clearNavigation } = useNavigationStore();

  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [dispatches, setDispatches] = useState<IncidentDispatch[]>([]);
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskLocalStatus>>({});
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, TaskLocalStatus>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [completionTarget, setCompletionTarget] = useState<CompletionTarget>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [routeModal, setRouteModal] = useState<{ title: string; fromNode: string; toNode: string } | null>(null);
  const [routeModalGeoJson, setRouteModalGeoJson] = useState<IndoorRouteGeoJsonResponse | null>(null);
  const [routeModalFloor, setRouteModalFloor] = useState<'0' | '1' | '2'>('1');
  const [routeModalLoading, setRouteModalLoading] = useState(false);
  const [routeModalError, setRouteModalError] = useState<string | null>(null);

  // Bins and monitoring tabs/states
  const [activeTab, setActiveTab] = useState<'tasks' | 'bins'>('tasks');
  const [bins, setBins] = useState<any[]>([]);
  const [binAlerts, setBinAlerts] = useState<any[]>([]);
  const [binsSearch, setBinsSearch] = useState('');
  const [binsFilter, setBinsFilter] = useState<'all' | 'full' | 'empty'>('all');

  // Nearest tasks state
  const [nearestTasks, setNearestTasks] = useState<NearestTaskInfo[]>([]);
  const [nearestLoading, setNearestLoading] = useState(false);

  const clearCurrentRouteIfMatches = useCallback((ids: Array<string | number | undefined | null>) => {
    if (!activeNavigation) return;

    const targetIds = new Set(ids.filter((id) => id != null).map((id) => String(id)));
    if (
      targetIds.has(activeNavigation.taskId) ||
      targetIds.has(activeNavigation.binId) ||
      targetIds.has(activeNavigation.targetNode)
    ) {
      clearNavigation();
      setRouteModal(null);
      setRouteModalGeoJson(null);
      setRouteModalError(null);
    }
  }, [activeNavigation, clearNavigation]);

  // Ocupado se tiver pelo menos uma tarefa/dispatch aceite
  const isBusy = Object.values(taskStatus).some(s => s === 'accepted') ||
                 Object.values(dispatchStatus).some(s => s === 'accepted') ||
                 tasks.some((task) => isAcceptedStatus(task.status)) ||
                 dispatches.some((dispatch) => isAcceptedStatus(dispatch.status));

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const myId = String(user.id);
      const isCleaningOrSupervisor = user.role && ['Cleaning', 'Supervisor'].includes(user.role);

      const promises: Promise<any>[] = [
        api.getMyTasks(myId),
        axios.get(`${EMERGENCY_SERVICE}/dispatch/active`, { timeout: 6000 })
          .then(r => r.data as IncidentDispatch[]).catch(() => [] as IncidentDispatch[]),
        axios.get(`${EMERGENCY_SERVICE}/incidents`, { timeout: 6000 })
          .then(r => (r.data.incidents ?? r.data) as IncidentSummary[]).catch(() => [] as IncidentSummary[]),
      ];

      if (isCleaningOrSupervisor) {
        promises.push(gisApi.getPois().catch(() => null));
        promises.push(api.getBinAlerts().catch(() => []));
      }

      const results = await Promise.all(promises);
      const tasksData = results[0];
      const allDispatches = results[1];
      const allIncidents = results[2];

      const myDispatches = (allDispatches as IncidentDispatch[]).filter(
        (d: IncidentDispatch) => d.responder_id === myId ||
             d.responder_id === `STAFF_${user.role?.toUpperCase()}_${myId.padStart(3, '0')}`
      );

      const enriched = myDispatches.map((d: IncidentDispatch) => {
        const inc = (allIncidents as IncidentSummary[]).find((i: IncidentSummary) => i.id === d.incident_id);
        return {
          ...d,
          incident_type: inc?.incident_type ?? 'incident',
          incident_location: inc?.location_node ?? '?',
          incident_severity: inc?.severity ?? 'medium',
          incident_description: inc?.description ?? inc?.location_description ?? null,
        };
      });

      setDispatches(enriched);

      if (isCleaningOrSupervisor) {
        const poisRes = results[3];
        const alertsData = results[4];

        if (poisRes) {
          const binFeatures = (poisRes?.features || []).filter(
            (f: any) => f.properties.category === 'bin' || f.properties.name?.toLowerCase().includes('lixeira')
          );
          setBins(binFeatures);
        }
        if (alertsData) {
          setBinAlerts(alertsData);
        }
      }

      setTasks(tasksData);

      setLastUpdated(new Date());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchTasks();

    const eventSource =
      typeof window !== 'undefined'
        ? new EventSource(EMERGENCY_EVENTS_URL, { withCredentials: true })
        : null;

    const handleOperationalUpdate = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        console.debug('[Tasks SSE] Received update:', parsed.type || 'unknown');
      } catch {
        console.debug('[Tasks SSE] Received update');
      }

      setRefreshing(true);
      void fetchTasks();
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
      eventSource?.addEventListener(eventType, handleOperationalUpdate);
    });

    eventSource?.addEventListener('connected', () => {
      console.info('[Tasks SSE] Connected');
    });

    eventSource?.addEventListener('error', () => {
      console.warn('[Tasks SSE] Disconnected; the browser will retry automatically');
    });

    const interval = setInterval(() => { setRefreshing(true); void fetchTasks(); }, 15000);
    return () => {
      eventSource?.close();
      clearInterval(interval);
    };
  }, [fetchTasks]);

  useEffect(() => {
    if (!user?.id || !user?.role) return;
    
    let active = true;
    const calculateDistances = async () => {
      setNearestLoading(true);
      try {
        let fromNode = getDefaultStartNode(user.role);
        try {
          const positions = await api.getStaffPositions([String(user.id)]);
          if (positions && positions.length > 0 && positions[0].location_id) {
            fromNode = String(positions[0].location_id);
          }
        } catch (err) {
          console.warn("[Tasks Routing] Could not fetch staff position for nearest-task calculation:", err);
        }

        const candidates: { id: string; type: 'bin' | 'dispatch'; node: string; title: string; original: any }[] = [];
        const isCleaning = user.role === 'Cleaning';
        const isSupervisor = user.role === 'Supervisor';
        const isSecurityOrMedical = ['Security', 'Medical'].includes(user.role);

        if (isCleaning || isSupervisor) {
          const activeFullBins = (binAlerts || []).filter(
            (a: any) => a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'done' && !a.completed_at && (a.fill_percentage >= 100)
          );
          activeFullBins.forEach((b: any) => {
            candidates.push({
              id: b.id,
              type: 'bin',
              node: String(b.location_node),
              title: `Caixote do lixo cheio (${b.bin_id ?? 'Ecoponto'})`,
              original: b
            });
          });
        }

        if (isSecurityOrMedical || isSupervisor) {
          const activeDispatchesFiltered = (dispatches || []).filter(
            (d: any) => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'done'
          );
          activeDispatchesFiltered.forEach((d: any) => {
            const targetNode = getDispatchTarget(d);
            candidates.push({
              id: d.id,
              type: 'dispatch',
              node: String(targetNode),
              title: `Incidente: ${d.incident_type ?? 'Emergência'}`,
              original: d
            });
          });
        }

        if (candidates.length === 0) {
          if (active) setNearestTasks([]);
          return;
        }

        const results: NearestTaskInfo[] = [];
        await Promise.all(
          candidates.map(async (c) => {
            try {
              const { route, geoJsonRoute } = await getRouteWithFallback(fromNode, c.node);
              const dist = geoJsonRoute?.summary?.distance ?? 150;
              const eta = geoJsonRoute?.summary?.eta_seconds ?? 90;
              results.push({
                id: c.id,
                type: c.type,
                title: c.title,
                node: c.node,
                distance: Math.round(dist),
                etaSeconds: eta,
                originalItem: c.original
              });
            } catch (err) {
              console.error(`[Tasks Routing] Failed to calculate distance to node ${c.node}:`, err);
            }
          })
        );

        results.sort((a, b) => a.distance - b.distance);
        if (active) setNearestTasks(results);
      } catch (err) {
        console.error("[Tasks Routing] Failed to update nearest tasks:", err);
      } finally {
        if (active) setNearestLoading(false);
      }
    };

    void calculateDistances();
    return () => {
      active = false;
    };
  }, [user?.id, user?.role, binAlerts, dispatches, tasks]);

  // --- Task actions ---
  const handleAcceptTask = async (taskId: string) => {
    setActionLoading(`accept-${taskId}`);
    try {
      await api.startTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'accepted' }));
      await fetchTasks();
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefuseTask = async (taskId: string) => {
    setActionLoading(`refuse-${taskId}`);
    try {
      await api.refuseTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'refused' }));
      clearCurrentRouteIfMatches([taskId]);
      await fetchTasks();
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to guarantee there is always a route
  const getRouteWithFallback = async (fromNode: string, toNode: string) => {
    const cleanNodeId = (val: string | number | undefined | null): number => {
      if (val == null) return 0;
      const str = String(val).trim().toUpperCase();
      const cleaned = str.replace(/^N/, '');
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? 0 : parsed;
    };
    const cleanFrom = cleanNodeId(fromNode);
    const cleanTo = cleanNodeId(toNode);
    const cleanFromStr = String(cleanFrom);
    const cleanToStr = String(cleanTo);

    try {
      // 1. Try normal routing (avoiding blocks)
      const [route, geoJsonRoute] = await Promise.all([
        api.getRoute(cleanFromStr, cleanToStr).catch(() => ({ waypoints: [], eta_seconds: 120 })),
        indoorRoutingService.getRouteGeoJson(cleanFrom, cleanTo, false),
      ]);
      return { route, geoJsonRoute };
    } catch (err) {
      console.warn(`[Tasks Routing] Route ${cleanFrom} to ${cleanTo} failed; retrying with blocked edges allowed:`, err);
      try {
        // 2. Try routing allowing blocked edges
        const [route, geoJsonRoute] = await Promise.all([
          api.getRoute(cleanFromStr, cleanToStr).catch(() => ({ waypoints: [], eta_seconds: 120 })),
          indoorRoutingService.getRouteGeoJson(cleanFrom, cleanTo, true),
        ]);
        return { route, geoJsonRoute };
      } catch (err2) {
        console.warn(`[Tasks Routing] Blocked-edge route failed; retrying fallback route 62 to ${cleanTo}:`, err2);
        try {
          // 3. Try fallback start node (allowing blocked edges)
          const [route, geoJsonRoute] = await Promise.all([
            api.getRoute('62', cleanToStr).catch(() => ({ waypoints: [], eta_seconds: 120 })),
            indoorRoutingService.getRouteGeoJson(62, cleanTo, true),
          ]);
          return { route, geoJsonRoute };
        } catch (err3) {
          console.warn(`[Tasks Routing] Fallback route 62 to ${cleanTo} failed; retrying route 62 to 65:`, err3);
          try {
            // 4. Try fallback start to fallback destination
            const [route, geoJsonRoute] = await Promise.all([
              api.getRoute('62', '65').catch(() => ({ waypoints: [], eta_seconds: 120 })),
              indoorRoutingService.getRouteGeoJson(62, 65, true),
            ]);
            return { route, geoJsonRoute };
          } catch (err4) {
            console.warn('[Tasks Routing] Fallback route 62 to 65 failed; using synthetic straight-line route:', err4);
            const syntheticGeoJson: IndoorRouteGeoJsonResponse = {
              route: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    id: 99999,
                    geometry: {
                      type: 'LineString',
                      coordinates: [
                        [-8.6291, 41.1618],
                        [-8.6285, 41.1625]
                      ]
                    },
                    properties: {
                      edge_id: 99999,
                      seq: 1,
                      from_node: cleanFrom,
                      to_node: cleanTo,
                      floor_id: 1,
                      current_floor_id: 1,
                      next_floor_id: 1,
                      length: 150,
                      type: 'corridor',
                      cost_multiplier: 1.0,
                      override_reason: null,
                      override_source: null,
                      override_severity: null
                    }
                  }
                ]
              },
              summary: {
                start_node: cleanFrom,
                end_node: cleanTo,
                distance: 150,
                eta_seconds: 90,
                floors: [1],
                uses_vertical_transition: false,
                impacted_edge_count: 0,
                impacted_edges: []
              }
            };
            return {
              route: { waypoints: [] as any, eta_seconds: 90 },
              geoJsonRoute: syntheticGeoJson
            };
          }
        }
      }
    }
  };

  const handleNavigateTask = async (task: MaintenanceTask) => {
    setActionLoading(`nav-${task.id}`);
    let fromNode = getDefaultStartNode(user?.role);
    try {
      if (user?.id) {
        const positions = await api.getStaffPositions([String(user.id)]);
        if (positions && positions.length > 0 && positions[0].location_id) {
          fromNode = String(positions[0].location_id);
          console.debug(`[Tasks Routing] Using staff location node ${fromNode}`);
        }
      }
    } catch (err) {
      console.warn("[Tasks Routing] Could not fetch staff position; using default node:", err);
    }

    const targetNode = task.location_node;
    setRouteModal({
      title: task.description ?? `Tarefa em ${targetNode}`,
      fromNode,
      toNode: targetNode,
    });
    setRouteModalGeoJson(null);
    setRouteModalError(null);
    setRouteModalLoading(true);

    try {
      const { route, geoJsonRoute } = await getRouteWithFallback(fromNode, targetNode);
      const actualFromNode = String(geoJsonRoute.summary?.start_node || fromNode);
      const actualToNode = String(geoJsonRoute.summary?.end_node || targetNode);

      if (task.status !== 'in_progress') {
        await api.startTask(task.id).catch(() => null);
      }
      setTaskStatus(prev => ({ ...prev, [task.id]: 'accepted' }));
      setRouteModal(prev => prev ? { ...prev, fromNode: actualFromNode, toNode: actualToNode } : null);
      setNavigation({
        taskId: task.id,
        binId: task.main_metadata?.bin_id ?? task.id,
        binName: task.description ?? `Caixote do lixo ${actualToNode}`,
        targetNode: actualToNode,
        fromNode: actualFromNode,
        waypoints: (route.waypoints || []) as any,
        etaSeconds: route.eta_seconds,
      });
      setRouteModalGeoJson(geoJsonRoute);
      const firstFloor = getRouteStartFloor(geoJsonRoute, actualFromNode);
      if (firstFloor != null) {
        setRouteModalFloor(String(firstFloor) as '0' | '1' | '2');
      }
    } catch {
      setRouteModalError(t('common.route_error'));
    } finally {
      setActionLoading(null);
      setRouteModalLoading(false);
    }
  };

  const handleDoneTask = async (taskId: string) => {
    setActionLoading(`done-${taskId}`);
    try {
      await api.completeTask(taskId);
      setTaskStatus(prev => ({ ...prev, [taskId]: 'done' }));
      clearCurrentRouteIfMatches([taskId]);
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyBinTask = async (taskId: string) => {
    setActionLoading(`empty-${taskId}`);
    try {
      await api.updateTaskStatus(taskId, 'completed');
      setTaskStatus(prev => ({ ...prev, [taskId]: 'done' }));
      const task = tasks.find((item) => item.id === taskId);
      clearCurrentRouteIfMatches([taskId, task?.main_metadata?.bin_id, task?.location_node]);
      await fetchTasks();
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyBinAlert = async (alertId: string) => {
    setActionLoading(`empty-bin-${alertId}`);
    try {
      const alert = binAlerts.find((item) => String(item.id) === String(alertId));
      await api.updateTaskStatus(alertId, 'completed');
      setBinAlerts(prev => prev.filter(alert => alert.id !== alertId));
      clearCurrentRouteIfMatches([alertId, alert?.bin_id, alert?.location_node]);
      await fetchTasks();
    } catch {
      alert(t('common.complete_error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleNavigateToBin = async (binName: string, targetNode: string) => {
    setActionLoading(`nav-bin-${targetNode}`);
    let fromNode = getDefaultStartNode(user?.role);
    try {
      if (user?.id) {
        const positions = await api.getStaffPositions([String(user.id)]);
        if (positions && positions.length > 0 && positions[0].location_id) {
          fromNode = String(positions[0].location_id);
          console.debug(`[Tasks Routing] Using staff location node ${fromNode}`);
        }
      }
    } catch (err) {
      console.warn("[Tasks Routing] Could not fetch staff position; using default node:", err);
    }

    setRouteModal({
      title: `Rota para ${binName}`,
      fromNode,
      toNode: targetNode,
    });
    setRouteModalGeoJson(null);
    setRouteModalError(null);
    setRouteModalLoading(true);

    try {
      const { route, geoJsonRoute } = await getRouteWithFallback(fromNode, targetNode);
      const actualFromNode = String(geoJsonRoute.summary?.start_node || fromNode);
      const actualToNode = String(geoJsonRoute.summary?.end_node || targetNode);

      setRouteModal(prev => prev ? { ...prev, fromNode: actualFromNode, toNode: actualToNode } : null);
      setNavigation({
        taskId: `bin-nav-${actualToNode}`,
        binId: actualToNode,
        binName: binName,
        targetNode: actualToNode,
        fromNode: actualFromNode,
        waypoints: (route.waypoints || []) as any,
        etaSeconds: route.eta_seconds,
      });
      setRouteModalGeoJson(geoJsonRoute);
      const firstFloor = getRouteStartFloor(geoJsonRoute, actualFromNode);
      if (firstFloor != null) {
        setRouteModalFloor(String(firstFloor) as '0' | '1' | '2');
      }
    } catch {
      setRouteModalError(t('common.route_error'));
    } finally {
      setActionLoading(null);
      setRouteModalLoading(false);
    }
  };

  // --- Dispatch actions ---
  const handleAcceptDispatch = async (dispatchId: string) => {
    setActionLoading(`accept-dispatch-${dispatchId}`);
    try {
      await api.acceptDispatch(dispatchId);
      setDispatchStatus(prev => ({ ...prev, [dispatchId]: 'accepted' }));
      await fetchTasks();
    } catch {
      alert('Não foi possível aceitar este incidente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefuseDispatch = async (dispatchId: string) => {
    setActionLoading(`refuse-dispatch-${dispatchId}`);
    try {
      await api.refuseDispatch(dispatchId);
      setDispatchStatus(prev => ({ ...prev, [dispatchId]: 'refused' }));
      clearCurrentRouteIfMatches([dispatchId]);
      await fetchTasks();
    } catch {
      alert('Não foi possível recusar este incidente.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNavigateDispatch = async (d: IncidentDispatch) => {
    if (isFalseAlarmStatus(d.status)) return;

    setActionLoading(`nav-dispatch-${d.id}`);
    let fromNode = d.route_nodes[0] ?? getDefaultStartNode(user?.role);
    try {
      if (user?.id) {
        const positions = await api.getStaffPositions([String(user.id)]);
        if (positions && positions.length > 0 && positions[0].location_id) {
          fromNode = String(positions[0].location_id);
          console.debug(`[Tasks Routing] Using staff location node ${fromNode}`);
        }
      }
    } catch (err) {
      console.warn("[Tasks Routing] Could not fetch staff position; using default node:", err);
    }

    const targetNode = getDispatchTarget(d);
    setRouteModal({
      title: `${d.incident_type?.toUpperCase() ?? 'INCIDENTE'} em ${targetNode}`,
      fromNode,
      toNode: targetNode,
    });
    setRouteModalGeoJson(null);
    setRouteModalError(null);
    setRouteModalLoading(true);

    try {
      if (!isAcceptedStatus(d.status) && dispatchStatus[d.id] !== 'accepted') {
        await api.acceptDispatch(d.id).catch(() => null);
      }
      const { route, geoJsonRoute } = await getRouteWithFallback(fromNode, targetNode);
      const actualFromNode = String(geoJsonRoute.summary?.start_node || fromNode);
      const actualToNode = String(geoJsonRoute.summary?.end_node || targetNode);
      const waypoints: RouteWaypoint[] = (route.waypoints || []) as any;

      setDispatchStatus(prev => ({ ...prev, [d.id]: 'accepted' }));
      setRouteModal(prev => prev ? { ...prev, fromNode: actualFromNode, toNode: actualToNode } : null);
      setNavigation({
        taskId: d.id,
        binId: d.incident_id,
        binName: `${d.incident_type?.toUpperCase()} — ${actualToNode}`,
        targetNode: actualToNode,
        fromNode: actualFromNode,
        waypoints,
        etaSeconds: route.eta_seconds || d.eta_seconds,
      });
      setRouteModalGeoJson(geoJsonRoute);
      const firstFloor = getRouteStartFloor(geoJsonRoute, actualFromNode);
      if (firstFloor != null) {
        setRouteModalFloor(String(firstFloor) as '0' | '1' | '2');
      }
    } catch {
      setRouteModalError(t('common.route_error'));
    } finally {
      setActionLoading(null);
      setRouteModalLoading(false);
    }
  };

  const openCompletionDialog = (target: Exclude<CompletionTarget, null>) => {
    setCompletionTarget(target);
    setCompletionNotes('');
  };

  const closeCompletionDialog = () => {
    if (actionLoading?.startsWith('complete-')) return;
    setCompletionTarget(null);
    setCompletionNotes('');
  };

  const handleConfirmCompletion = async () => {
    if (!completionTarget || completionNotes.trim().length < 3) return;

    setActionLoading(`complete-${completionTarget.kind}-${completionTarget.id}`);
    try {
      if (completionTarget.kind === 'task') {
        await api.completeTask(completionTarget.id, completionNotes.trim());
        setTaskStatus(prev => ({ ...prev, [completionTarget.id]: 'done' }));
        const task = tasks.find((item) => item.id === completionTarget.id);
        clearCurrentRouteIfMatches([completionTarget.id, task?.main_metadata?.bin_id, task?.location_node]);
      } else {
        await api.completeDispatch(completionTarget.id, completionNotes.trim());
        setDispatchStatus(prev => ({ ...prev, [completionTarget.id]: 'done' }));
        const dispatch = dispatches.find((item) => item.id === completionTarget.id);
        clearCurrentRouteIfMatches([
          completionTarget.id,
          dispatch?.incident_id,
          dispatch ? getDispatchTarget(dispatch) : undefined,
        ]);
      }

      setCompletionTarget(null);
      setCompletionNotes('');
      await fetchTasks();
    } catch {
      alert('Não foi possível concluir esta tarefa.');
    } finally {
      setActionLoading(null);
    }
  };

  const activeTasks = tasks.filter(t => t.task_type !== 'bin_full' && taskStatus[t.id] !== 'refused' && taskStatus[t.id] !== 'done');
  const activeDispatches = dispatches.filter(d => !['refused', 'done'].includes(dispatchStatus[d.id] ?? ''));
  const highlightedNearestTask = nearestTasks[0] ?? null;
  const highlightedDispatch = highlightedNearestTask?.type === 'dispatch'
    ? activeDispatches.find((dispatch) => dispatch.id === highlightedNearestTask.id)
    : null;
  const highlightedDispatchStatus = highlightedDispatch
    ? dispatchStatus[highlightedDispatch.id] ?? (isAcceptedStatus(highlightedDispatch.status) ? 'accepted' : 'pending')
    : null;
  const visibleDispatches = highlightedNearestTask?.type === 'dispatch'
    ? activeDispatches.filter((dispatch) => dispatch.id !== highlightedNearestTask.id)
    : activeDispatches;
  const visibleTasks = highlightedNearestTask?.type === 'bin'
    ? activeTasks.filter((task) => task.id !== highlightedNearestTask.id && task.location_node !== highlightedNearestTask.node)
    : activeTasks;
  const hasVisibleOperations = visibleDispatches.length + visibleTasks.length > 0;
  const totalCount = activeTasks.length + activeDispatches.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Operações atribuídas</p>
            <h1 className="mt-2 text-3xl font-black text-gray-950">{t('tasks.title')}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm text-gray-500">
                {t(totalCount === 1 ? 'tasks.active_count_one' : 'tasks.active_count_other', { count: totalCount })}
              </p>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                isBusy ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isBusy ? 'bg-orange-500' : 'bg-green-500'}`} />
                {isBusy ? t('common.busy') : t('common.available')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-400">{t('common.updated_at')} {lastUpdated.toLocaleTimeString()}</span>
            )}
            <button
              onClick={() => { setRefreshing(true); void fetchTasks(); }}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Incidentes</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{activeDispatches.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Manutenção</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{activeTasks.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
            <p className="mt-1 text-lg font-black text-slate-950">{isBusy ? 'Em operação' : 'Disponível'}</p>
          </div>
        </div>
      </div>

      {/* Nearest Task Recommendation Section */}
      {highlightedNearestTask && (
        <div className="mb-6 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-6 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <MapPin size={24} className="animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-blue-500 text-[10px] font-black text-white items-center justify-center">1</span>
                </span>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  Mais Próxima de Si
                </span>
                <h3 className="mt-1 text-lg font-black text-slate-900">
                  {highlightedNearestTask.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Localização: <span className="font-extrabold text-slate-900">Nó {highlightedNearestTask.node}</span>
                  {' · '}
                  Distância: <span className="font-extrabold text-blue-700">{highlightedNearestTask.distance}m</span>
                  {' · '}
                  Caminhada: <span className="font-extrabold text-indigo-700">{Math.round(highlightedNearestTask.etaSeconds / 60)} min</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:self-center">
              <button
                onClick={async () => {
                  const tNode = highlightedNearestTask.node;
                  let fNode = getDefaultStartNode(user?.role);
                  try {
                    if (user?.id) {
                      const pos = await api.getStaffPositions([String(user.id)]);
                      if (pos && pos.length > 0 && pos[0].location_id) fNode = String(pos[0].location_id);
                    }
                  } catch {}
                  setRouteModal({
                    title: highlightedNearestTask.title,
                    fromNode: fNode,
                    toNode: tNode
                  });
                  setRouteModalLoading(true);
                  try {
                    const { geoJsonRoute } = await getRouteWithFallback(fNode, tNode);
                    setRouteModalGeoJson(geoJsonRoute);
                    const startFloor = String(getRouteStartFloor(geoJsonRoute, fNode) ?? '1') as '0' | '1' | '2';
                    setRouteModalFloor(startFloor);
                  } catch (err) {
                    setRouteModalError("Erro ao calcular rota.");
                  } finally {
                    setRouteModalLoading(false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/10 transition-all duration-200 hover:bg-blue-700 hover:shadow-lg"
              >
                <MapPin size={16} />
                Ver Rota
              </button>

              {highlightedNearestTask.type === 'bin' ? (
                <button
                  disabled={actionLoading === `empty-bin-${highlightedNearestTask.id}`}
                  onClick={() => void handleEmptyBinAlert(highlightedNearestTask.id)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Trash2 size={16} className="text-red-500" />
                  Esvaziar caixote do lixo
                </button>
              ) : (
                highlightedDispatchStatus === 'accepted' ? (
                  <button
                    disabled={!highlightedDispatch || !!actionLoading}
                    onClick={() => highlightedDispatch && openCompletionDialog({
                      kind: 'dispatch',
                      id: highlightedDispatch.id,
                      title: `${highlightedDispatch.incident_type ?? 'Incidente'} em ${getDispatchTarget(highlightedDispatch)}`,
                    })}
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    Concluir tarefa
                  </button>
                ) : (
                  <button
                    disabled={actionLoading === `accept-dispatch-${highlightedNearestTask.id}`}
                    onClick={() => void handleAcceptDispatch(highlightedNearestTask.id)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Check size={16} className="text-emerald-500" />
                    Aceitar Incidente
                  </button>
                )
              )}
            </div>
          </div>

          {nearestTasks.length > 1 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Outras tarefas próximas:</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {nearestTasks.slice(1, 4).map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    <span className="font-extrabold text-slate-800">#{idx + 2} {t.title}</span>
                    <span>(Nó {t.node} · {t.distance}m)</span>
                    <button
                      onClick={async () => {
                        let fNode = getDefaultStartNode(user?.role);
                        try {
                          if (user?.id) {
                            const pos = await api.getStaffPositions([String(user.id)]);
                            if (pos && pos.length > 0 && pos[0].location_id) fNode = String(pos[0].location_id);
                          }
                        } catch {}
                        setRouteModal({
                          title: t.title,
                          fromNode: fNode,
                          toNode: t.node
                        });
                        setRouteModalLoading(true);
                        try {
                          const { geoJsonRoute } = await getRouteWithFallback(fNode, t.node);
                          setRouteModalGeoJson(geoJsonRoute);
                          const startFloor = String(getRouteStartFloor(geoJsonRoute, fNode) ?? '1') as '0' | '1' | '2';
                          setRouteModalFloor(startFloor);
                        } catch (err) {
                          setRouteModalError("Erro ao calcular rota.");
                        } finally {
                          setRouteModalLoading(false);
                        }
                      }}
                      className="ml-1 font-bold text-blue-600 hover:underline"
                    >
                      Rota
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Selector for Cleaning / Supervisor */}
      {['Cleaning', 'Supervisor'].includes(user?.role ?? '') && (
        <div className="mb-6 flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all duration-200 ${
              activeTab === 'tasks'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ClipboardList size={18} />
            Minhas Tarefas ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('bins')}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all duration-200 ${
              activeTab === 'bins'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Trash2 size={18} />
            Estado dos caixotes do lixo ({bins.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">{t('tasks.loading')}</div>
      ) : activeTab === 'tasks' ? (
        totalCount === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="font-medium text-gray-700">{t('tasks.empty_title')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('tasks.empty_subtitle')}</p>
          </div>
        ) : !hasVisibleOperations ? null : (
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            {visibleDispatches.length > 0 && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-500">
                  <AlertTriangle size={14} /> {t('tasks.section_incidents')}
                </p>
                {visibleDispatches.map(d => {
                  const isFalseAlarm = isFalseAlarmStatus(d.status);
                  const status = isFalseAlarm
                    ? 'false_alarm'
                    : dispatchStatus[d.id] ?? (isAcceptedStatus(d.status) ? 'accepted' : 'pending');
                  const targetNode = getDispatchTarget(d);
                  return (
                    <div
                      key={d.id}
                      className={`rounded-3xl border p-5 shadow-sm ${
                        isFalseAlarm
                          ? 'border-slate-300 bg-[linear-gradient(180deg,#f8fafc,#fff)]'
                          : 'border-red-200 bg-[linear-gradient(180deg,#fff7f7,#fff)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          {isFalseAlarm ? (
                            <Ban size={18} className="shrink-0 text-slate-500" />
                          ) : (
                            <AlertTriangle size={18} className="text-red-500 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-gray-900 capitalize">{d.incident_type?.replace('_', ' ')}</p>
                            <p className="text-sm text-gray-500">{t('tasks.location')}: <span className="font-medium">{targetNode}</span></p>
                            <p className="mt-1 text-sm leading-relaxed text-gray-700">
                              {isFalseAlarm
                                ? 'O supervisor cancelou este incidente como falso alarme. Não é necessária intervenção.'
                                : d.incident_description || 'Sem descrição adicional do incidente.'}
                            </p>
                            {!isFalseAlarm && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                                <Clock size={12} /> ETA previsto: {Math.ceil((d.eta_seconds || 0) / 60)} min
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                          isFalseAlarm
                            ? 'border-slate-200 bg-slate-100 text-slate-700'
                            : d.incident_severity === 'critical'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : d.incident_severity === 'high'
                            ? 'border-orange-200 bg-orange-50 text-orange-700'
                            : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                        }`}>
                          {isFalseAlarm ? 'cancelado' : d.incident_severity}
                        </span>
                      </div>

                      {isFalseAlarm ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleConfirmCompletion()} // auto-cleans on submit notes
                            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <CheckCircle size={16} /> Tomei conhecimento
                          </button>
                        </div>
                      ) : status === 'accepted' ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleNavigateDispatch(d)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            <MapPin size={16} /> {t('common.navigate')}
                          </button>
                          <button
                            onClick={() => openCompletionDialog({
                              kind: 'dispatch',
                              id: d.id,
                              title: `${d.incident_type ?? 'Incidente'} em ${targetNode}`,
                            })}
                            disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle size={16} /> Concluir tarefa
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleAcceptDispatch(d.id)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                            <ThumbsUp size={16} /> {t('common.accept')}
                          </button>
                          <button onClick={() => handleNavigateDispatch(d)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            <MapPin size={16} /> {t('common.navigate')}
                          </button>
                          <button onClick={() => handleRefuseDispatch(d.id)} disabled={!!actionLoading} className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                            <X size={16} /> {t('common.refuse')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {visibleTasks.length > 0 && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500">
                  <ClipboardList size={14} /> {t('tasks.section_maintenance')}
                </p>
                {visibleTasks.map(task => {
                  const status = taskStatus[task.id] ?? (isAcceptedStatus(task.status) ? 'accepted' : 'pending');
                  const isBinTask = task.task_type === 'bin_full' || task.description?.toLowerCase().includes('lixeira');
                  return (
                    <div key={task.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {task.description ?? `Caixote do lixo ${task.main_metadata?.bin_id ?? task.location_node}`}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-gray-700">
                            {task.description || 'Sem descrição adicional da tarefa.'}
                          </p>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {t('tasks.location')}: {task.location_node}
                            {task.main_metadata?.fill_percentage != null && (
                              <span className="ml-2 font-medium text-orange-600">{task.main_metadata.fill_percentage}% {t('tasks.fill')}</span>
                            )}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.low}`}>
                          {task.priority}
                        </span>
                      </div>
                      {status === 'accepted' ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleNavigateTask(task)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            <MapPin size={16} /> {t('common.navigate')}
                          </button>
                          {isBinTask ? (
                            <button
                              onClick={() => handleEmptyBinTask(task.id)}
                              disabled={!!actionLoading}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Trash2 size={16} /> Esvaziar caixote do lixo
                            </button>
                          ) : (
                            <button
                              onClick={() => openCompletionDialog({
                                kind: 'task',
                                id: task.id,
                                title: task.description ?? `Tarefa em ${task.location_node}`,
                              })}
                              disabled={!!actionLoading}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle size={16} /> Concluir tarefa
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleAcceptTask(task.id)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                            <ThumbsUp size={16} /> {t('common.accept')}
                          </button>
                          <button onClick={() => handleNavigateTask(task)} disabled={!!actionLoading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                            <MapPin size={16} /> {t('common.navigate')}
                          </button>
                          <button onClick={() => handleRefuseTask(task.id)} disabled={!!actionLoading} className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                            <X size={16} /> {t('common.refuse')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      ) : (
        /* Bins tab view */
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-950">Estado dos caixotes do lixo</h2>
              <p className="text-sm text-slate-500 mt-1">
                Visualização em tempo real de todos os caixotes do lixo do estádio.
              </p>
            </div>
            
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={binsSearch}
                  onChange={(e) => setBinsSearch(e.target.value)}
                  placeholder="Procurar caixote do lixo..."
                  className="rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-950 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setBinsFilter('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                    binsFilter === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setBinsFilter('full')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                    binsFilter === 'full' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Cheias 🔴
                </button>
                <button
                  onClick={() => setBinsFilter('empty')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                    binsFilter === 'empty' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Limpas 🟢
                </button>
              </div>
            </div>
          </div>

          {/* Bins Grid */}
          {(() => {
            const parseNodeId = (val: any) => {
              if (val == null) return null;
              const str = String(val).trim().toUpperCase();
              const cleaned = str.replace(/^N/, '');
              const parsed = parseInt(cleaned, 10);
              return isNaN(parsed) ? null : parsed;
            };

            const filteredBins = bins.filter(bin => {
              const nameMatches = (bin.properties.name || '').toLowerCase().includes(binsSearch.toLowerCase()) ||
                                  String(bin.properties.node_id).toLowerCase().includes(binsSearch.toLowerCase());
              
              const activeAlerts = (binAlerts || []).filter(
                (alert: any) => alert.status !== 'completed' && alert.status !== 'cancelled' && alert.status !== 'done' && !alert.completed_at
              );
              const poiNodeId = parseNodeId(bin.properties.node_id);
              const alertForPoi = activeAlerts.find(
                (alert: any) => parseNodeId(alert.location_node) === poiNodeId
              );
              const fillPct = alertForPoi ? (alertForPoi.fill_percentage ?? 0) : 0;
              const isFull = alertForPoi && fillPct >= 100;

              if (binsFilter === 'full') return nameMatches && isFull;
              if (binsFilter === 'empty') return nameMatches && !isFull;
              return nameMatches;
            });

            if (filteredBins.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400 font-medium">
                  Nenhum caixote do lixo corresponde aos filtros selecionados.
                </div>
              );
            }

            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBins.map(bin => {
                  const poiNodeId = parseNodeId(bin.properties.node_id);
                  const activeAlerts = (binAlerts || []).filter(
                    (alert: any) => alert.status !== 'completed' && alert.status !== 'cancelled' && alert.status !== 'done' && !alert.completed_at
                  );
                  const alertForPoi = activeAlerts.find(
                    (alert: any) => parseNodeId(alert.location_node) === poiNodeId
                  );
                  const fillPct = alertForPoi ? (alertForPoi.fill_percentage ?? 0) : 0;
                  const isFull = alertForPoi && fillPct >= 100;

                  return (
                    <div
                      key={bin.properties.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition shadow-sm ${
                        isFull 
                          ? 'border-red-100 bg-[linear-gradient(180deg,#fff7f7,#fff)]' 
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`rounded-xl p-2.5 ${
                              isFull ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              <Trash2 size={20} />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">
                                {bin.properties.name || `Caixote do lixo · nó ${bin.properties.node_id}`}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Piso {bin.properties.floor_id} · Nó {bin.properties.node_id}
                              </p>
                            </div>
                          </div>
                          
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-green-500'}`} />
                            {isFull ? `Cheio (${Math.round(fillPct)}%)` : fillPct > 0 ? `Limpo (${Math.round(fillPct)}%)` : 'Limpo'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2">
                        {isFull && alertForPoi && (
                          <button
                            onClick={() => void handleEmptyBinAlert(alertForPoi.id)}
                            disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                          >
                            <Check size={14} /> Esvaziar
                          </button>
                        )}
                        <button
                          onClick={() => void handleNavigateToBin(bin.properties.name || `Caixote do lixo ${bin.properties.node_id}`, String(bin.properties.node_id))}
                          disabled={!!actionLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          <MapPin size={14} /> Rota
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {routeModal && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center bg-white/45 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Rota operacional</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{routeModal.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  De {routeModal.fromNode} até nó {routeModal.toNode}
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
                    setRouteModal(null);
                    setRouteModalGeoJson(null);
                    setRouteModalError(null);
                  }}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Fechar rota"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {routeModalLoading ? (
                <div className="flex h-[32rem] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                  <RefreshCw size={18} className="mr-2 animate-spin" />
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

      {completionTarget && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Conclusão da tarefa</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">{completionTarget.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Descreve o que foi feito. Este registo fica associado à tua atribuição, não fecha automaticamente o incidente completo.
              </p>
            </div>

            <textarea
              value={completionNotes}
              onChange={(event) => setCompletionNotes(event.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex.: Cheguei ao local, confirmei a ocorrência, zona estabilizada e reporte feito ao supervisor."
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
            {completionNotes.trim().length > 0 && completionNotes.trim().length < 3 && (
              <p className="mt-2 text-xs font-medium text-red-600">A descrição tem de ter pelo menos 3 caracteres.</p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeCompletionDialog}
                disabled={!!actionLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCompletion()}
                disabled={!!actionLoading || completionNotes.trim().length < 3}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading?.startsWith('complete-') ? 'A concluir...' : 'Concluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
