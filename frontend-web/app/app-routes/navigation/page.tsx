'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Navigation, RefreshCw } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { PoiSelect } from '@/components/navigation/PoiSelect';
import { RouteDetailsCard } from '@/components/navigation/RouteDetailsCard';
import { AlertsPanel } from '@/components/navigation/AlertsPanel';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import {
  type EdgeOverride,
  indoorRoutingService,
  type GraphStatus,
  type IndoorRouteResponse,
  type IndoorRouteGeoJsonResponse,
  type OperationalEvent,
  type Poi,
} from '@/lib/services/indoorRouting';

const OUTDOOR_OPTIONS: Poi[] = [
  {
    id: 1001,
    label: 'Outside Entrance',
    name: 'Outside Entrance',
    node_id: 1001,
    floor_id: 0,
    category: 'outdoor',
    isOutdoor: true,
  },
  {
    id: 1003,
    label: 'Parking Area',
    name: 'Parking Area',
    node_id: 1003,
    floor_id: 0,
    category: 'outdoor',
    isOutdoor: true,
  },
];

export default function NavigationPage() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [edgeOverrides, setEdgeOverrides] = useState<EdgeOverride[]>([]);
  const [startPoiId, setStartPoiId] = useState('');
  const [destinationPoiId, setDestinationPoiId] = useState('');
  const [route, setRoute] = useState<IndoorRouteResponse | null>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<IndoorRouteGeoJsonResponse | null>(null);
  const [selectedRouteFloor, setSelectedRouteFloor] = useState(1);
  const [loadingPois, setLoadingPois] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [loadingLiveData, setLoadingLiveData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const routingOptions = useMemo(
    () => [
      ...OUTDOOR_OPTIONS,
      ...pois.map((poi) => ({
        ...poi,
        label: poi.room_name ? `${poi.room_name} · ${poi.name}` : poi.name,
        isOutdoor: false,
      })),
    ],
    [pois]
  );

  const selectedStartOption = useMemo(
    () => routingOptions.find((option) => String(option.id) === startPoiId) ?? null,
    [routingOptions, startPoiId]
  );

  const selectedDestinationOption = useMemo(
    () => routingOptions.find((option) => String(option.id) === destinationPoiId) ?? null,
    [routingOptions, destinationPoiId]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingPois(true);
        setLoadingLiveData(true);
        setError(null);

        const [poiData, status, liveEvents, overrides] = await Promise.all([
          indoorRoutingService.getPois(),
          indoorRoutingService.getGraphStatus().catch(() => null),
          indoorRoutingService.getEvents().catch(() => []),
          indoorRoutingService.getEdgeOverrides().catch(() => []),
        ]);

        setPois(poiData);
        setGraphStatus(status);
        setEvents(liveEvents);
        setEdgeOverrides(overrides);
      } catch {
        setError('Unable to load indoor POIs right now.');
      } finally {
        setLoadingPois(false);
        setLoadingLiveData(false);
      }
    };

    void loadInitialData();
  }, []);

  const handleRefreshStatus = async () => {
    try {
      setRefreshingStatus(true);
      const [status, liveEvents, overrides] = await Promise.all([
        indoorRoutingService.getGraphStatus(),
        indoorRoutingService.getEvents().catch(() => []),
        indoorRoutingService.getEdgeOverrides().catch(() => []),
      ]);
      setGraphStatus(status);
      setEvents(liveEvents);
      setEdgeOverrides(overrides);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleCalculateRoute = async (recalculate = false) => {
    if (!startPoiId || !destinationPoiId) {
      setError('Please select both a start POI and a destination POI.');
      return;
    }

    if (startPoiId === destinationPoiId) {
      setError('Start and destination must be different POIs.');
      return;
    }

    try {
      setLoadingRoute(true);
      setError(null);

      if (recalculate) {
        await handleRefreshStatus();
      }

      if (!selectedStartOption || !selectedDestinationOption) {
        throw new Error('Missing routing options');
      }

      const startIsOutdoor = selectedStartOption.isOutdoor || selectedStartOption.node_id >= 1000;
      const destinationIsOutdoor =
        selectedDestinationOption.isOutdoor || selectedDestinationOption.node_id >= 1000;

      if (startIsOutdoor || destinationIsOutdoor) {
        const response = await indoorRoutingService.getCombinedRoute(
            selectedStartOption.node_id,
            selectedDestinationOption.node_id
        );

        setRoute(response);
        setRouteGeoJson(null);
      } else {
        const [response, geoJsonResponse] = await Promise.all([
          indoorRoutingService.getRouteByPoi(Number(startPoiId), Number(destinationPoiId)),
          indoorRoutingService.getRouteGeoJsonByPoi(Number(startPoiId), Number(destinationPoiId)),
        ]);

        setRoute(response);
        setRouteGeoJson(geoJsonResponse);
        if (geoJsonResponse.summary.floors.length > 0) {
          setSelectedRouteFloor(geoJsonResponse.summary.floors[0]);
        }
      }

      await handleRefreshStatus();
    } catch {
      setError('Unable to calculate route.');
      setRoute(null);
      setRouteGeoJson(null);
    } finally {
      setLoadingRoute(false);
    }
  };

  const statusStyles: Record<string, string> = {
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    degraded: 'bg-amber-50 text-amber-700 border-amber-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  };

  const blockedOverrides = useMemo(
    () => edgeOverrides.filter((override) => override.is_blocked && override.is_active),
    [edgeOverrides]
  );

  const activeEvents = useMemo(
    () => events.filter((event) => event.is_active && event.status === 'active'),
    [events]
  );

  const routeAffected = Boolean(
    route &&
      (
        graphStatus?.status === 'degraded' ||
        graphStatus?.status === 'critical' ||
        blockedOverrides.length > 0 ||
        activeEvents.length > 0
      )
  );

  return (
    <div className="mobile-page-shell mx-auto max-w-5xl space-y-6">
      <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Rotas indoor</p>
            <h1 className="mt-2 text-3xl font-semibold">Navegação para POI</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
              Select a starting point and a destination to request an indoor route from the backend.
            </p>
          </div>

          {graphStatus && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${statusStyles[graphStatus.status] ?? 'bg-white/10 text-white border-white/20'}`}>
              <p className="font-semibold capitalize">{graphStatus.status}</p>
              <p className="mt-1 text-xs opacity-90">
                {graphStatus.blocked_edges} blocked edges · {graphStatus.active_alerts} active alerts
              </p>
              <p className="mt-1 text-xs opacity-90">
                {graphStatus.cost_overrides} cost overrides
              </p>
            </div>
          )}
        </div>
      </div>

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pedido de rota</h2>
            <p className="text-sm text-gray-500">Esta primeira versão foca-se apenas na seleção de POI e nas instruções da rota.</p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefreshStatus()}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} className={refreshingStatus ? 'animate-spin' : ''} />
            Refresh status
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PoiSelect
            id="start-poi"
            label="Start POI"
            value={startPoiId}
            onChange={setStartPoiId}
            options={routingOptions}
            disabled={loadingPois}
          />
          <PoiSelect
            id="destination-poi"
            label="Destination POI"
            value={destinationPoiId}
            onChange={setDestinationPoiId}
            options={routingOptions}
            disabled={loadingPois}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
          {selectedStartOption && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              Start node: {selectedStartOption.node_id}
            </span>
          )}
          {selectedDestinationOption && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              Destination node: {selectedDestinationOption.node_id}
            </span>
          )}
        </div>

        <div className="mt-6">
          <AppButton
            title="Calcular rota"
            onClick={() => void handleCalculateRoute()}
            loading={loadingRoute}
            disabled={loadingPois || !startPoiId || !destinationPoiId}
            icon="send"
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      </Surface>

      <RouteDetailsCard
        route={route}
        routeAffected={routeAffected}
        onRecalculate={() => void handleCalculateRoute(true)}
        recalculating={loadingRoute}
      />

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Mapa da rota</h3>
            <p className="text-sm text-gray-500">
              {routeGeoJson
                ? `${routeGeoJson.summary.distance}m · ${routeGeoJson.summary.floors.length} floor segment(s) · ${routeGeoJson.summary.impacted_edge_count} impacted edge(s)`
                : 'Calculate an indoor POI route to draw it over the GIS map.'}
            </p>
          </div>

          {routeGeoJson && (
            <div className="flex rounded-2xl bg-gray-100 p-1 text-sm">
              {routeGeoJson.summary.floors.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  onClick={() => setSelectedRouteFloor(floor)}
                  className={`rounded-xl px-3 py-2 font-medium transition ${
                    selectedRouteFloor === floor ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Floor {floor}
                </button>
              ))}
            </div>
          )}
        </div>

        <IndoorGisMap
          floorId={selectedRouteFloor}
          routeGeoJson={routeGeoJson?.route ?? null}
          routeAffected={routeAffected}
        />
      </Surface>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Surface className="border border-gray-200 p-5" elevation="sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Condições do grafo em tempo real</h3>
            <p className="text-sm text-gray-500">Disponibilidade atual dos caminhos e alterações com impacto na rota.</p>
          </div>

          {blockedOverrides.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Some paths are currently blocked. Routes may be affected.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arestas bloqueadas</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{blockedOverrides.length}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alertas ativos</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{activeEvents.length}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</p>
                  <p className="mt-2 text-2xl font-semibold capitalize text-gray-900">{graphStatus?.status ?? 'unknown'}</p>
                </div>
              </div>

              <div className="space-y-3">
                {blockedOverrides.map((override) => (
                  <div key={override.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">Blocked path on edge {override.edge_id}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {override.reason || 'No reason provided'} · Severity {override.severity.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              {loadingLiveData ? 'Loading blocked paths...' : 'No blocked paths right now.'}
            </div>
          )}
        </Surface>

        <AlertsPanel events={activeEvents} loading={loadingLiveData} />
      </div>

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Navigation size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">POIs disponíveis</h3>
            <p className="text-sm text-gray-500">
              {loadingPois ? 'A carregar POIs...' : `${pois.length} POIs carregados pelo backend de cálculo de rotas.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pois.map((poi) => (
            <div key={poi.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-medium text-gray-900">{poi.room_name || poi.name}</p>
              {poi.room_name && poi.room_name !== poi.name ? (
                <p className="mt-1 text-sm text-gray-500">POI: {poi.name}</p>
              ) : null}
              <p className="mt-1 text-sm text-gray-500">Category: {poi.room_type || poi.category}</p>
              <p className="mt-1 text-sm text-gray-500">Floor {poi.floor_id} · Node {poi.node_id}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
