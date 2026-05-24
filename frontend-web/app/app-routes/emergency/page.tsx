'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, DoorOpen, Loader2, MapPin, ShieldAlert } from 'lucide-react';
import { api, type GlobalEvacuation } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { IndoorGisMap } from '@/components/map/IndoorGisMap';
import type { GisFeatureCollection, RouteEdgeProperties } from '@/lib/services/gisApi';

const EXIT_NODE = '65';
const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-slate-600';

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSafeAtExit(location?: string | null, exitNode = EXIT_NODE) {
  return String(location ?? '').trim() === String(exitNode);
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
  const [form, setForm] = useState({
    title: 'Evacuação do edifício',
    description: '',
    emergency_type: 'fire',
    severity: 'critical',
    source_node: '62',
    floor_id: '1',
    affected_nodes: '',
    affected_zones: 'Entrada IT',
    instructions: 'Dirige-te para a entrada do IT e confirma quando estiveres no nó 65.',
  });

  const safeConfirmed = useMemo(() => {
    if (!user?.id || !evacuation.confirmations) return false;
    return Boolean(evacuation.confirmations[String(user.id)]);
  }, [evacuation.confirmations, user?.id]);

  const loadState = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [active, staff] = await Promise.all([
        api.getActiveGlobalEvacuation().catch(() => ({ active: false })),
        api.getStaff().catch(() => []),
      ]);

      const me = staff.find((member) => Number(member.id) === Number(user?.id));
      const location = me?.location ? String(me.location) : '';
      setCurrentLocation(location);
      setEvacuation(active);

      if (active.active && location) {
        const route = await api.getEvacuationRouteGeoJson(location).catch(() => null);
        setRouteGeoJson(route);
      } else {
        setRouteGeoJson(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadState();
    const interval = window.setInterval(() => void loadState(), 15000);
    return () => window.clearInterval(interval);
  }, [loadState]);

  async function handleCreateEvacuation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupervisor) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const created = await api.createGlobalEvacuation({
        title: form.title,
        description: form.description || undefined,
        emergency_type: form.emergency_type,
        severity: form.severity,
        source_node: form.source_node,
        floor_id: form.floor_id ? Number(form.floor_id) : undefined,
        affected_nodes: splitList(form.affected_nodes),
        affected_zones: splitList(form.affected_zones),
        instructions: form.instructions || undefined,
      });
      setEvacuation(created);
      setMessage('Emergência declarada. As rotas de evacuação passam a usar a entrada do IT como saída segura.');
      await loadState();
    } catch (error) {
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
      setMessage('Confirmação registada. Ficas marcado como seguro nesta evacuação.');
    } catch {
      setMessage(`Só podes confirmar segurança quando a tua localização atual for o nó ${EXIT_NODE}.`);
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

  const canConfirmSafe = evacuation.active && isSafeAtExit(currentLocation, evacuation.exit_node || EXIT_NODE);
  const blockedNodeIds = useMemo(() => splitList(form.affected_nodes), [form.affected_nodes]);
  const selectedNodeIds = useMemo(
    () => [form.source_node, ...blockedNodeIds].filter(Boolean),
    [blockedNodeIds, form.source_node]
  );
  const formFloorId = Number(form.floor_id) || 1;

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
    <div className="min-h-screen bg-slate-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600">Emergência</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Evacuação operacional</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                A evacuação é declarada pelo supervisor e todos os utilizadores recebem rota para a entrada do IT, nó {EXIT_NODE}.
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

        <div className="grid gap-5 lg:grid-cols-[25rem_1fr]">
          <section className="space-y-6">
            {isSupervisor && (
              <form onSubmit={handleCreateEvacuation} className="rounded-[1.75rem] border border-red-200 bg-white p-5 shadow-sm">
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
                        <option value="critical">Crítico</option>
                        <option value="high">Alto</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Nó do problema</label>
                      <input className={fieldClass} value={form.source_node} onChange={(e) => setForm((prev) => ({ ...prev, source_node: e.target.value }))} placeholder="62" required />
                    </div>
                    <div>
                      <label className={labelClass}>Piso</label>
                      <input className={fieldClass} value={form.floor_id} onChange={(e) => setForm((prev) => ({ ...prev, floor_id: e.target.value }))} placeholder="1" />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Nós a bloquear</label>
                    <input className={fieldClass} value={form.affected_nodes} onChange={(e) => setForm((prev) => ({ ...prev, affected_nodes: e.target.value }))} placeholder="Opcional. Ex: 58, 59" />
                    <p className="mt-1.5 text-xs leading-4 text-slate-500">
                      Deixa vazio se quiseres apenas avisar; preenche se houver nós/corredores a evitar.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">Escolher no mapa</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Clica num nó para {nodePickMode === 'source' ? 'definir o problema' : 'adicionar/remover bloqueio'}.
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

                    <IndoorGisMap
                      floorId={formFloorId}
                      nodeSelectionMode={nodePickMode}
                      selectedNodeIds={selectedNodeIds}
                      onNodeSelect={handleNodeSelect}
                      heightClassName="h-80"
                      showCameraControls={false}
                    />

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Problema: {form.source_node || 'não definido'}</span>
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-800">
                        Bloqueados: {blockedNodeIds.length ? blockedNodeIds.join(', ') : 'nenhum'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Zona afetada</label>
                    <input className={fieldClass} value={form.affected_zones} onChange={(e) => setForm((prev) => ({ ...prev, affected_zones: e.target.value }))} placeholder="Ex: Entrada IT" />
                  </div>

                  <div>
                    <label className={labelClass}>Instruções</label>
                    <textarea className={`${fieldClass} min-h-20 resize-y`} value={form.instructions} onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))} placeholder="Instruções para os utilizadores" />
                  </div>

                  <button disabled={submitting || evacuation.active} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                    {submitting ? 'A processar...' : evacuation.active ? 'Emergência ativa' : 'Submeter emergência'}
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Estado atual</h2>
              {evacuation.active ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-black text-red-900">{evacuation.title}</p>
                    <p className="mt-1 text-sm text-red-800">{evacuation.description || 'Sem descrição adicional.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-3 py-1 text-red-700">Nó problema: {evacuation.source_node}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-red-700">Saída: {evacuation.exit_node}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-red-700">Seguros: {evacuation.evacuated_count ?? 0}</span>
                    </div>
                  </div>
                  {evacuation.instructions && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{evacuation.instructions}</p>}
                  {isSupervisor ? (
                    <button onClick={handleCompleteEvacuation} disabled={submitting} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50">
                      Terminar evacuação
                    </button>
                  ) : (
                    <button onClick={handleSafeConfirmation} disabled={!canConfirmSafe || submitting || safeConfirmed} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {safeConfirmed ? 'Já estás marcado como seguro' : canConfirmSafe ? 'Já estou seguro' : `Disponível no nó ${evacuation.exit_node || EXIT_NODE}`}
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

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">Rota de evacuação</h2>
                <p className="text-sm text-slate-500">
                  {currentLocation ? `Localização atual: nó ${currentLocation}` : 'Localização atual não disponível'} · Saída segura: nó {evacuation.exit_node || EXIT_NODE}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                <DoorOpen size={14} /> Entrada IT
              </div>
            </div>

            {evacuation.active && routeGeoJson ? (
              <IndoorGisMap floorId={evacuation.floor_id || 1} routeGeoJson={routeGeoJson} routeAffected={false} />
            ) : (
              <div className="flex min-h-[30rem] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
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
    </div>
  );
}
