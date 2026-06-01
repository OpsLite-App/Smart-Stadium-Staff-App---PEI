'use client';

import { useCallback, useEffect, useMemo, useState, useRef, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, DoorOpen, Loader2, MapPin, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { api, EMERGENCY_EVENTS_URL, type GlobalEvacuation } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import type { GisFeatureCollection, RouteEdgeProperties } from '@/lib/services/gisApi';

const EXIT_NODE = '65';
const EVACUATION_SAFE_STORAGE_KEY = 'opslite-safe-evacuations';
const FLOOR_OPTIONS = [
  { id: 0, label: 'Piso 0' },
  { id: 1, label: 'Piso 1' },
  { id: 2, label: 'Piso 2' },
];
const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-600';

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sem hora registada';

  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hasConfirmedSafety(evacuation: GlobalEvacuation, user: { id?: number; email?: string } | null) {
  if (!evacuation.confirmations || !user) return false;

  return Boolean(
    (user.id != null && evacuation.confirmations[String(user.id)]) ||
      (user.email && evacuation.confirmations[user.email])
  );
}

function userSafetyKey(user: { id?: number; email?: string } | null) {
  if (!user) return null;
  if (user.id != null) return `id:${user.id}`;
  if (user.email) return `email:${user.email}`;
  return null;
}

function readLocalSafetyConfirmations() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(EVACUATION_SAFE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && !Array.isArray(parsed) && typeof parsed === 'object'
      ? (parsed as Record<string, string[]>)
      : {};
  } catch {
    return {};
  }
}

function markEvacuationConfirmedLocally(evacuationId: string, user: { id?: number; email?: string } | null) {
  if (typeof window === 'undefined') return;
  const key = userSafetyKey(user);
  if (!key) return;

  const confirmations = readLocalSafetyConfirmations();
  const ids = confirmations[key] ?? [];
  confirmations[key] = Array.from(new Set([...ids, evacuationId]));
  window.localStorage.setItem(EVACUATION_SAFE_STORAGE_KEY, JSON.stringify(confirmations));
}

function hasConfirmedLocally(evacuationId: string | undefined, user: { id?: number; email?: string } | null) {
  const key = userSafetyKey(user);
  if (!evacuationId || !key) return false;

  return (readLocalSafetyConfirmations()[key] ?? []).includes(evacuationId);
}

export default function EmergencyPage() {
  const { user } = useAuthStore();
  const isSupervisor = user?.role === 'Supervisor';
  const [evacuation, setEvacuation] = useState<GlobalEvacuation>({ active: false });
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [routeGeoJson, setRouteGeoJson] = useState<GisFeatureCollection<RouteEdgeProperties> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nodePickMode, setNodePickMode] = useState<'source' | 'blocked'>('source');
  const [routeFloorId, setRouteFloorId] = useState(1);
  const [locallyConfirmedToken, setLocallyConfirmedToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    emergency_type: '',
    severity: '',
    source_node: '',
    floor_id: '1',
    affected_nodes: '',
    affected_zones: '',
    instructions: '',
  });

  const safeConfirmed = useMemo(() => {
    const localToken = evacuation.id && userSafetyKey(user)
      ? `${userSafetyKey(user)}:${evacuation.id}`
      : null;

    return (
      Boolean(localToken && locallyConfirmedToken === localToken) ||
      hasConfirmedLocally(evacuation.id, user) ||
      hasConfirmedSafety(evacuation, user)
    );
  }, [evacuation, locallyConfirmedToken, user]);

  const isFirstLoadRef = useRef(true);

  const loadState = useCallback(async () => {
    if (isFirstLoadRef.current) {
      setLoading(true);
    }
    setMessage(null);

    try {
      const [active, staff, positions] = await Promise.all([
        api.getActiveGlobalEvacuation().catch(() => ({ active: false })),
        api.getStaff().catch(() => []),
        api.getAllStaffPositions().catch(() => []),
      ]);

      const me = staff.find((member) => Number(member.id) === Number(user?.id));
      const myPos = positions.find((p) => Number(p.staff_id) === Number(user?.id));
      const location = myPos?.location_id ? String(myPos.location_id) : (me?.location ? String(me.location) : '');
      setCurrentLocation(location);
      setEvacuation(active);

      if (active.active) {
        const evacInfo = active as GlobalEvacuation;
        const startNode = location && !isNaN(Number(location)) ? location : evacInfo.source_node;
        if (startNode) {
          const route = await api.getEvacuationRouteGeoJson(startNode).catch(() => null);
          setRouteGeoJson(route);
        } else {
          setRouteGeoJson(null);
        }
      } else {
        setRouteGeoJson(null);
      }
    } finally {
      setLoading(false);
      isFirstLoadRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    void loadState();
    const eventSource =
      typeof window !== 'undefined'
        ? new EventSource(EMERGENCY_EVENTS_URL, { withCredentials: true })
        : null;

    const handleRealtimeUpdate = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        console.debug('[Emergency SSE] Received update:', parsed.type || 'unknown');
      } catch {
        console.debug('[Emergency SSE] Received update');
      }
      void loadState();
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
      console.info('[Emergency SSE] Connected');
    });

    eventSource?.addEventListener('error', () => {
      console.warn('[Emergency SSE] Disconnected; the browser will retry automatically');
    });

    const interval = window.setInterval(() => void loadState(), 15000);
    return () => {
      eventSource?.close();
      window.clearInterval(interval);
    };
  }, [loadState]);

  async function handleCreateEvacuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupervisor) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const created = await api.createGlobalEvacuation({
        title: form.title.trim(),
        description: form.description || undefined,
        emergency_type: form.emergency_type,
        severity: form.severity,
        source_node: form.source_node.trim(),
        floor_id: form.floor_id ? Number(form.floor_id) : undefined,
        affected_nodes: splitList(form.affected_nodes),
        affected_zones: splitList(form.affected_zones),
        instructions: form.instructions || undefined,
      });
      setEvacuation(created);
      setMessage('Emergência declarada. As rotas de evacuação passam a usar a entrada do IT como saída segura.');
      await loadState();
    } catch {
      setMessage('Não foi possível declarar a emergência. Confirma se já existe uma evacuação ativa.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSafeConfirmation() {
    if (!evacuation.id) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const updated = await api.markEvacuationSafe(evacuation.id, currentLocation);
      setEvacuation(updated);
      const key = userSafetyKey(user);
      setLocallyConfirmedToken(key ? `${key}:${evacuation.id}` : null);
      markEvacuationConfirmedLocally(evacuation.id, user);
      setMessage('Confirmação registada. Obrigado, ficas marcado como seguro nesta evacuação.');
    } catch {
      setMessage('Não foi possível registar a confirmação de segurança. Tenta novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteEvacuation() {
    if (!evacuation.id || !isSupervisor) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const updated = await api.completeGlobalEvacuation(evacuation.id);
      setEvacuation(updated);
      setRouteGeoJson(null);
      setMessage('Evacuação terminada e bloqueios criados pela emergência removidos.');
    } catch {
      setMessage('Não foi possível terminar a evacuação.');
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirmSafe = evacuation.active;
  const blockedNodeIds = useMemo(() => splitList(form.affected_nodes), [form.affected_nodes]);
  const selectedNodeIds = useMemo(
    () => [form.source_node, ...blockedNodeIds].filter(Boolean),
    [blockedNodeIds, form.source_node]
  );
  const formFloorId = Number(form.floor_id) || 1;
  const isCreatingEvacuation = isSupervisor && !evacuation.active;
  const canCreateEvacuation = Boolean(
    form.title.trim() &&
    form.description.trim() &&
    form.emergency_type &&
    form.severity &&
    form.source_node.trim()
  );
  const confirmedCount = evacuation.evacuated_count ?? Object.keys(evacuation.confirmations ?? {}).length;
  const affectedZones = evacuation.affected_zones ?? [];
  const activeBlockedNodes = evacuation.affected_nodes ?? [];
  const availableRouteFloors = useMemo(() => {
    const floors = new Set<number>();
    routeGeoJson?.features.forEach((feature) => {
      const floor = feature.properties.floor_id ?? feature.properties.current_floor_id;
      if (typeof floor === 'number') floors.add(floor);
    });

    if (floors.size === 0 && evacuation.floor_id != null) floors.add(evacuation.floor_id);
    return FLOOR_OPTIONS.filter((option) => floors.has(option.id));
  }, [evacuation.floor_id, routeGeoJson]);

  useEffect(() => {
    if (availableRouteFloors.length === 0) return;
    if (!availableRouteFloors.some((floor) => floor.id === routeFloorId)) {
      setRouteFloorId(availableRouteFloors[0].id);
    }
  }, [availableRouteFloors, routeFloorId]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    if (nodePickMode === 'source') {
      setForm((prev) => ({ ...prev, source_node: nodeId }));
      return;
    }

    setForm((prev) => {
      const current = splitList(prev.affected_nodes);
      const exists = current.includes(nodeId);
      const next = exists ? current.filter((item) => item !== nodeId) : [...current, nodeId];
      return { ...prev, affected_nodes: next.join(', ') };
    });
  }, [nodePickMode]);

  return (
    <div className="mobile-page-shell w-full space-y-6">
        <header className="rounded-xl border border-red-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600">Emergência</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Evacuação operacional</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Consulta a rota recomendada, segue para a saída segura e confirma quando estiveres fora de perigo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadState()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
              Atualizar
            </button>
          </div>
        </header>

        {message && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <section className="space-y-6">
            {isSupervisor && evacuation.active && (
              <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-2xl bg-red-100 p-3 text-red-700">
                      <ShieldAlert size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Comando ativo</p>
                      <h2 className="mt-1 text-lg font-black text-slate-950">{evacuation.title}</h2>
                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        Evacuação em curso desde {formatDateTime(evacuation.initiated_at)}.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black uppercase text-red-700">
                    {evacuation.severity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                      <MapPin size={14} /> Origem
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">Nó {evacuation.source_node}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                      <DoorOpen size={14} /> Saída
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">Nó {evacuation.exit_node}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700">
                      <Users size={14} /> Seguros
                    </div>
                    <p className="mt-2 text-xl font-black text-emerald-900">{confirmedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                      <ShieldCheck size={14} /> Estado
                    </div>
                    <p className="mt-2 text-xl font-black text-slate-950">Ativa</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Instruções para a equipa</p>
                    <p className="mt-2 text-sm leading-5 text-slate-700">
                      {evacuation.instructions || 'Seguir a rota indicada e confirmar segurança quando estiverem fora de perigo.'}
                    </p>
                  </div>

                  {(affectedZones.length > 0 || activeBlockedNodes.length > 0) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-100 bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Zonas afetadas</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          {affectedZones.length ? affectedZones.join(', ') : 'Sem zona definida'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Nós bloqueados</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          {activeBlockedNodes.length ? activeBlockedNodes.join(', ') : 'Sem bloqueios manuais'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void loadState()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                    Atualizar estado
                  </button>
                  <button
                    type="button"
                    onClick={handleCompleteEvacuation}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {submitting ? 'A encerrar...' : 'Encerrar evacuação'}
                  </button>
                </div>
              </div>
            )}

            {isSupervisor && !evacuation.active && (
              <form onSubmit={handleCreateEvacuation} className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="rounded-2xl bg-red-100 p-3 text-red-700">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Declarar emergência</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Define o local do problema. A saída segura é sempre o nó <span className="font-black text-slate-900">{EXIT_NODE}</span>.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Título</label>
                    <input className={fieldClass} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ex: Incêndio no corredor" required />
                  </div>

                  <div>
                    <label className={labelClass}>Descrição</label>
                    <textarea className={`${fieldClass} min-h-24 resize-y`} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Descreve brevemente o que aconteceu." />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Tipo</label>
                      <select className={fieldClass} value={form.emergency_type} onChange={(e) => setForm((prev) => ({ ...prev, emergency_type: e.target.value }))}>
                        <option value="" disabled>Seleciona o tipo</option>
                        <option value="fire">Incêndio</option>
                        <option value="gas">Gás/Fumo</option>
                        <option value="structural">Estrutural</option>
                        <option value="security">Segurança</option>
                        <option value="other">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Gravidade</label>
                      <select className={fieldClass} value={form.severity} onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}>
                        <option value="" disabled>Seleciona a gravidade</option>
                        <option value="critical">Crítico</option>
                        <option value="high">Alto</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Nó do problema</label>
                      <input className={fieldClass} value={form.source_node} onChange={(e) => setForm((prev) => ({ ...prev, source_node: e.target.value }))} placeholder="Seleciona no mapa ou escreve o nó" required />
                    </div>
                    <div>
                      <label className={labelClass}>Piso</label>
                      <select className={fieldClass} value={form.floor_id} onChange={(e) => setForm((prev) => ({ ...prev, floor_id: e.target.value }))}>
                        {FLOOR_OPTIONS.map((floor) => (
                          <option key={floor.id} value={String(floor.id)}>{floor.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Nós a bloquear</label>
                    <input className={fieldClass} value={form.affected_nodes} onChange={(e) => setForm((prev) => ({ ...prev, affected_nodes: e.target.value }))} placeholder="Opcional. Ex: 58, 59" />
                    <p className="mt-1.5 text-xs leading-4 text-slate-500">
                      Deixa vazio se quiseres apenas avisar; preenche se houver nós/corredores a evitar.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">Selecionar na camada GIS</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Usa o mapa grande à direita para clicar nos nós reais do piso selecionado.
                        </p>
                      </div>
                      <div className="flex rounded-xl bg-white p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setNodePickMode('source')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-black ${nodePickMode === 'source' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          Problema
                        </button>
                        <button
                          type="button"
                          onClick={() => setNodePickMode('blocked')}
                          className={`rounded-lg px-3 py-1.5 text-xs font-black ${nodePickMode === 'blocked' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                          Bloquear
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Problema: {form.source_node || 'não definido'}</span>
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">
                        Bloqueados: {blockedNodeIds.length ? blockedNodeIds.join(', ') : 'nenhum'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Zona afetada</label>
                    <input className={fieldClass} value={form.affected_zones} onChange={(e) => setForm((prev) => ({ ...prev, affected_zones: e.target.value }))} placeholder="Opcional. Ex: Sala de estudo, corredor central" />
                  </div>

                  <div>
                    <label className={labelClass}>Instruções</label>
                    <textarea className={`${fieldClass} min-h-20 resize-y`} value={form.instructions} onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))} placeholder="Opcional. Ex: Seguir a rota indicada e confirmar segurança no exterior." />
                  </div>

                  <button disabled={submitting || !canCreateEvacuation} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                    {submitting ? 'A processar...' : 'Ativar evacuação'}
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Estado atual</h2>
              {evacuation.active ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white p-2 text-red-700">
                        <AlertTriangle size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-red-950">{evacuation.title}</p>
                        <p className="mt-1 text-sm leading-5 text-red-800">
                          {evacuation.description || 'Evacuação ativa. Mantém a calma e segue a rota indicada.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-3">
                      <div className="rounded-xl bg-white px-3 py-2 text-red-800">
                        <p className="text-red-500">Origem</p>
                        <p className="mt-0.5">Nó {evacuation.source_node}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-red-800">
                        <p className="text-red-500">Saída segura</p>
                        <p className="mt-0.5">Nó {evacuation.exit_node}</p>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-red-800">
                        <p className="text-red-500">Confirmados</p>
                        <p className="mt-0.5">{evacuation.evacuated_count ?? 0}</p>
                      </div>
                    </div>
                  </div>
                  {evacuation.instructions && (
                    <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-5 text-slate-700">
                      {evacuation.instructions}
                    </p>
                  )}
                  {!isSupervisor && (
                    <button onClick={handleSafeConfirmation} disabled={!canConfirmSafe || submitting || safeConfirmed} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {safeConfirmed ? 'Segurança confirmada' : submitting ? 'A confirmar...' : 'Confirmar que estou em segurança'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex items-center gap-2 font-black"><CheckCircle2 size={18} /> Sem evacuação ativa</div>
                  <p className="mt-1">Quando o supervisor declarar uma emergência, esta página mostra a rota para o nó {EXIT_NODE}.</p>
                </div>
              )}
            </div>
          </section>

          <section className="flex min-h-[calc(100vh-9rem)] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  {isCreatingEvacuation ? 'Layer GIS da emergência' : 'Rota de evacuação'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isCreatingEvacuation
                    ? `Clica num nó para ${nodePickMode === 'source' ? 'definir o problema' : 'adicionar/remover bloqueio'} no ${FLOOR_OPTIONS.find((floor) => floor.id === formFloorId)?.label ?? `Piso ${formFloorId}`}.`
                    : `${currentLocation ? 'A partir da tua posição atual' : 'A aguardar localização atual'} · saída segura no nó ${evacuation.exit_node || EXIT_NODE}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isCreatingEvacuation ? (
                  <div className="flex rounded-2xl bg-slate-100 p-1">
                    {FLOOR_OPTIONS.map((floor) => (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, floor_id: String(floor.id) }))}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition ${formFloorId === floor.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        {floor.label}
                      </button>
                    ))}
                  </div>
                ) : availableRouteFloors.length > 0 && (
                  <div className="flex rounded-2xl bg-slate-100 p-1">
                    {availableRouteFloors.map((floor) => (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => setRouteFloorId(floor.id)}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition ${routeFloorId === floor.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        {floor.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                  <DoorOpen size={14} /> Entrada IT
                </div>
              </div>
            </div>

            {isCreatingEvacuation ? (
              <div className="flex min-h-0 flex-1 flex-col space-y-3">
                <IndoorGisMap
                  floorId={formFloorId}
                  nodeSelectionMode={nodePickMode}
                  selectedNodeIds={selectedNodeIds}
                  onNodeSelect={handleNodeSelect}
                  heightClassName="h-[calc(100vh-19rem)] min-h-[34rem]"
                  showCameraControls={false}
                  showStaffMarkers={false}
                />
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-800">
                    Problema: {form.source_node || 'não definido'}
                  </span>
                  <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-800">
                    Bloqueados: {blockedNodeIds.length ? blockedNodeIds.join(', ') : 'nenhum'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                    Modo: {nodePickMode === 'source' ? 'definir problema' : 'bloquear nós'}
                  </span>
                </div>
              </div>
            ) : evacuation.active && routeGeoJson ? (
              <IndoorGisMap floorId={routeFloorId} routeGeoJson={routeGeoJson} routeAffected={false} />
            ) : (
              <div className="flex min-h-[30rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <div>
                  <MapPin className="mx-auto text-slate-400" size={32} />
                  <p className="mt-3 text-sm font-bold text-slate-700">Sem rota ativa para mostrar</p>
                  <p className="mt-1 text-sm text-slate-500">A rota aparece quando existe evacuação ativa e a tua localização é conhecida.</p>
                </div>
              </div>
            )}
          </section>
        </div>
    </div>
  );
}
