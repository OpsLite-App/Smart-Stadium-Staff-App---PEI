'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Navigation, RefreshCw } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { PoiSelect } from '@/components/navigation/PoiSelect';
import { RouteDetailsCard } from '@/components/navigation/RouteDetailsCard';
import {
  indoorRoutingService,
  type GraphStatus,
  type IndoorRouteResponse,
  type Poi,
} from '@/lib/services/indoorRouting';

export default function NavigationPage() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [startPoiId, setStartPoiId] = useState('');
  const [destinationPoiId, setDestinationPoiId] = useState('');
  const [route, setRoute] = useState<IndoorRouteResponse | null>(null);
  const [loadingPois, setLoadingPois] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStart = useMemo(
    () => pois.find((poi) => String(poi.id) === startPoiId) ?? null,
    [pois, startPoiId]
  );

  const selectedDestination = useMemo(
    () => pois.find((poi) => String(poi.id) === destinationPoiId) ?? null,
    [pois, destinationPoiId]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingPois(true);
        setError(null);

        const [poiData, status] = await Promise.all([
          indoorRoutingService.getPois(),
          indoorRoutingService.getGraphStatus().catch(() => null),
        ]);

        setPois(poiData);
        setGraphStatus(status);
      } catch {
        setError('Unable to load indoor POIs right now.');
      } finally {
        setLoadingPois(false);
      }
    };

    void loadInitialData();
  }, []);

  const handleRefreshStatus = async () => {
    try {
      setRefreshingStatus(true);
      const status = await indoorRoutingService.getGraphStatus();
      setGraphStatus(status);
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleCalculateRoute = async () => {
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

      const response = await indoorRoutingService.getRouteByPoi(
        Number(startPoiId),
        Number(destinationPoiId)
      );

      setRoute(response);
      await handleRefreshStatus();
    } catch {
      setError('Could not calculate the indoor route. Please try again.');
      setRoute(null);
    } finally {
      setLoadingRoute(false);
    }
  };

  const statusStyles: Record<string, string> = {
    healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    degraded: 'bg-amber-50 text-amber-700 border-amber-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-3xl bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Indoor Routing</p>
            <h1 className="mt-2 text-3xl font-semibold">POI Navigation</h1>
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
            </div>
          )}
        </div>
      </div>

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Route Request</h2>
            <p className="text-sm text-gray-500">This first version focuses on POI selection and route instructions only.</p>
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
            options={pois}
            disabled={loadingPois}
          />
          <PoiSelect
            id="destination-poi"
            label="Destination POI"
            value={destinationPoiId}
            onChange={setDestinationPoiId}
            options={pois}
            disabled={loadingPois}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
          {selectedStart && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              Start node: {selectedStart.node_id}
            </span>
          )}
          {selectedDestination && (
            <span className="rounded-full bg-gray-100 px-3 py-1">
              Destination node: {selectedDestination.node_id}
            </span>
          )}
        </div>

        <div className="mt-6">
          <AppButton
            title="Calculate Route"
            onClick={() => void handleCalculateRoute()}
            loading={loadingRoute}
            disabled={loadingPois || !startPoiId || !destinationPoiId}
            icon="send"
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
          />
        </div>
      </Surface>

      <RouteDetailsCard route={route} />

      <Surface className="border border-gray-200 p-5" elevation="sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Navigation size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Available POIs</h3>
            <p className="text-sm text-gray-500">
              {loadingPois ? 'Loading POIs...' : `${pois.length} POIs loaded from the routing backend.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pois.map((poi) => (
            <div key={poi.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-medium text-gray-900">{poi.name}</p>
              <p className="mt-1 text-sm text-gray-500">Category: {poi.category}</p>
              <p className="mt-1 text-sm text-gray-500">Floor {poi.floor_id} · Node {poi.node_id}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
