'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { CHAT_SERVICE, api, type StaffMember } from '@/lib/services/api';
import { useAuthStore } from '@/lib/stores/useAuthStore';

type RoomKind = 'channel' | 'direct' | 'incident';

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  kind: RoomKind;
  role?: string;
  peer?: StaffMember;
  priority?: 'normal' | 'high';
}

interface ChatApiMessage {
  id: number;
  room: string;
  sender_id: string;
  sender_name: string;
  text: string;
  ts: string;
}

const SYSTEM_ROOMS: ChatRoom[] = [
  {
    id: 'general',
    name: 'Operações gerais',
    description: 'Canal comum para coordenação entre equipas.',
    kind: 'channel',
  },
  {
    id: 'security',
    name: 'Segurança',
    description: 'Coordenação da equipa de segurança.',
    kind: 'channel',
    role: 'Security',
  },
  {
    id: 'cleaning',
    name: 'Limpeza',
    description: 'Pedidos e coordenação da equipa de limpeza.',
    kind: 'channel',
    role: 'Cleaning',
  },
  {
    id: 'medical',
    name: 'Médico',
    description: 'Coordenação de incidentes médicos.',
    kind: 'channel',
    role: 'Medical',
  },
  {
    id: 'incidents',
    name: 'Incidentes ativos',
    description: 'Canal para contexto operacional de incidentes.',
    kind: 'incident',
    priority: 'high',
  },
];

function normalizeRole(value?: string) {
  return (value || '').toLowerCase();
}

function directRoomId(currentUserId: number, peerId: number) {
  const [low, high] = [currentUserId, peerId].sort((a, b) => a - b);
  return `dm-${low}-${high}`;
}

function formatTime(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function roomIcon(room: ChatRoom) {
  if (room.kind === 'direct') return MessageCircle;
  if (room.kind === 'incident') return AlertTriangle;
  if (room.role === 'Security') return Shield;
  if (room.role === 'Cleaning') return Sparkles;
  return Users;
}

function roomTone(room: ChatRoom) {
  if (room.priority === 'high') return 'bg-red-50 text-red-700 border-red-100';
  if (room.kind === 'direct') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (room.role === 'Security') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (room.role === 'Cleaning') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (room.role === 'Medical') return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-indigo-50 text-indigo-700 border-indigo-100';
}

function mapStaffToRooms(staff: StaffMember[], currentUserId?: number): ChatRoom[] {
  if (!currentUserId) return [];

  return staff
    .filter((member) => member.id !== currentUserId)
    .map((member) => ({
      id: directRoomId(currentUserId, member.id),
      name: member.name || `Staff ${member.id}`,
      description: `${member.role || 'Staff'} · localização ${member.location || 'desconhecida'}`,
      kind: 'direct' as const,
      role: member.role,
      peer: member,
    }));
}

function readStorageKey(userId?: number) {
  return `chat-read-receipts:${userId ?? 'anonymous'}`;
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [rooms, setRooms] = useState<ChatRoom[]>(SYSTEM_ROOMS);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatApiMessage[]>>({});
  const [readReceipts, setReadReceipts] = useState<Record<string, string>>({});
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const visibleRooms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const role = normalizeRole(user?.role);

    return rooms
      .filter((room) => {
        if (!room.role || room.kind === 'direct') return true;
        return normalizeRole(room.role) === role || role === 'supervisor';
      })
      .filter((room) => {
        if (!normalizedSearch) return true;
        return `${room.name} ${room.description}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((a, b) => {
        const aLast = messagesByRoom[a.id]?.at(-1)?.ts;
        const bLast = messagesByRoom[b.id]?.at(-1)?.ts;
        const aTime = aLast ? new Date(aLast).getTime() : 0;
        const bTime = bLast ? new Date(bLast).getTime() : 0;

        if (aTime !== bTime) return bTime - aTime;
        if (a.kind !== b.kind) return a.kind === 'channel' ? -1 : b.kind === 'channel' ? 1 : 0;
        return a.name.localeCompare(b.name, 'pt');
      });
  }, [messagesByRoom, rooms, searchTerm, user?.role]);

  const selectedMessages = selectedRoom ? messagesByRoom[selectedRoom.id] ?? [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedMessages.length]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(readStorageKey(user.id));
      setReadReceipts(stored ? JSON.parse(stored) : {});
    } catch {
      setReadReceipts({});
    }
  }, [user?.id]);

  const persistReadReceipts = (nextReceipts: Record<string, string>) => {
    setReadReceipts(nextReceipts);
    if (!user?.id || typeof window === 'undefined') return;
    window.localStorage.setItem(readStorageKey(user.id), JSON.stringify(nextReceipts));
  };

  const markRoomAsRead = (roomId: string, messageList = messagesByRoom[roomId] ?? []) => {
    const lastMessage = messageList.at(-1);
    if (!lastMessage) return;

    persistReadReceipts({
      ...readReceipts,
      [roomId]: lastMessage.ts,
    });
  };

  const isRoomUnread = (roomId: string) => {
    const lastMessage = messagesByRoom[roomId]?.at(-1);
    if (!lastMessage || !user?.id) return false;
    if (String(lastMessage.sender_id) === String(user.id)) return false;

    const readAt = readReceipts[roomId];
    if (!readAt) return true;

    return new Date(lastMessage.ts).getTime() > new Date(readAt).getTime();
  };

  useEffect(() => {
    if (!selectedRoom || selectedMessages.length === 0) return;
    markRoomAsRead(selectedRoom.id, selectedMessages);
  }, [selectedRoom?.id, selectedMessages.at(-1)?.ts]);

  const fetchMessages = async (roomId: string, showLoader = true) => {
    try {
      if (showLoader) setLoadingMessages(true);
      const response = await axios.get<ChatApiMessage[]>(`${CHAT_SERVICE}/messages/${roomId}`, {
        timeout: 8000,
      });
      const ordered = [...(response.data ?? [])].sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );
      setMessagesByRoom((previous) => ({ ...previous, [roomId]: ordered }));
      setError(null);
      return ordered;
    } catch {
      setError('Não foi possível carregar mensagens do serviço de conversação.');
      setMessagesByRoom((previous) => ({ ...previous, [roomId]: previous[roomId] ?? [] }));
      return [];
    } finally {
      if (showLoader) setLoadingMessages(false);
    }
  };

  const loadRooms = async () => {
    try {
      setLoadingRooms(true);
      const staff = await api.getStaff();
      const directRooms = mapStaffToRooms(staff, user?.id);
      const nextRooms = [...SYSTEM_ROOMS, ...directRooms];
      setRooms(nextRooms);

      await Promise.all(
        nextRooms.map((room) => fetchMessages(room.id, false).catch(() => []))
      );
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    void loadRooms();
  }, [user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      rooms.forEach((room) => {
        void fetchMessages(room.id, false);
      });
    }, 7000);

    return () => clearInterval(timer);
  }, [rooms]);

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
    void fetchMessages(room.id).then((messageList) => markRoomAsRead(room.id, messageList));
  };

  useEffect(() => {
    if (loadingRooms || rooms.length === 0 || !user?.id) return;

    const staffId = searchParams.get('staffId');
    const roomId = searchParams.get('room');
    const requestedRoom = staffId
      ? rooms.find((room) => room.kind === 'direct' && String(room.peer?.id) === String(staffId))
      : roomId
        ? rooms.find((room) => room.id === roomId)
        : null;

    if (requestedRoom && selectedRoom?.id !== requestedRoom.id) {
      handleSelectRoom(requestedRoom);
    }
  }, [loadingRooms, rooms, searchParams, selectedRoom?.id, user?.id]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoom || !user || !messageText.trim()) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const response = await axios.post<ChatApiMessage>(
        `${CHAT_SERVICE}/messages/`,
        {
          room: selectedRoom.id,
          sender_id: String(user.id ?? 0),
          sender_name: user.email?.split('@')[0] || 'Staff',
          text: content,
        },
        { timeout: 8000 }
      );

      setMessagesByRoom((previous) => ({
        ...previous,
        [selectedRoom.id]: [...(previous[selectedRoom.id] ?? []), response.data],
      }));
      persistReadReceipts({
        ...readReceipts,
        [selectedRoom.id]: response.data.ts,
      });
      setError(null);
    } catch {
      setError('Mensagem não enviada. Confirma se o serviço de conversação está ativo.');
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const lastMessageForRoom = (roomId: string) => messagesByRoom[roomId]?.at(-1);
  const chatHeightClass = user?.role === 'Supervisor'
    ? 'h-[calc(100dvh-10rem)]'
    : 'h-[calc(100dvh-4rem)]';

  return (
    <div className={`grid ${chatHeightClass} overflow-hidden grid-cols-1 bg-slate-100 md:grid-cols-[30rem_minmax(0,1fr)]`}>
      <aside className={`${selectedRoom ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white`}>
        <div className="border-b border-slate-200 p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Comunicação</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Conversa operacional</h1>
              <p className="mt-2 text-base text-slate-500">Mensagens reais persistidas no serviço de conversação.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadRooms()}
              className="rounded-2xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50"
              title="Atualizar"
            >
              <RefreshCw size={22} className={loadingRooms ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="relative mt-7">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={21} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar canal ou contacto..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingRooms && rooms.length === SYSTEM_ROOMS.length ? (
            <div className="flex h-40 items-center justify-center text-base text-slate-500">A carregar conversas...</div>
          ) : visibleRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-base text-slate-500">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRooms.map((room) => {
                const Icon = roomIcon(room);
                const lastMessage = lastMessageForRoom(room.id);
                const active = selectedRoom?.id === room.id;
                const unread = isRoomUnread(room.id);

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleSelectRoom(room)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      active
                        ? 'border-blue-200 bg-blue-50 shadow-sm'
                        : unread
                          ? 'border-blue-100 bg-blue-50/60 shadow-sm hover:border-blue-200'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${roomTone(room)}`}>
                        {room.kind === 'direct' ? <span className="text-base font-black">{initials(room.name)}</span> : <Icon size={23} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className={`truncate text-lg font-bold ${unread ? 'text-blue-950' : 'text-slate-950'}`}>
                              {room.name}
                            </p>
                            {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />}
                          </div>
                          {lastMessage && (
                            <span className={`shrink-0 text-sm ${unread ? 'font-bold text-blue-700' : 'text-slate-400'}`}>
                              {formatTime(lastMessage.ts)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">{room.description}</p>
                        <p className={`mt-3 truncate text-base ${unread ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                          {lastMessage ? `${lastMessage.sender_name}: ${lastMessage.text}` : 'Sem mensagens ainda'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <main className={`${selectedRoom ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col bg-white`}>
        {selectedRoom ? (
          <>
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-8 py-6">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRoom(null)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 md:hidden"
                >
                  Voltar
                </button>
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border ${roomTone(selectedRoom)}`}>
                  {selectedRoom.kind === 'direct' ? (
                    <span className="text-lg font-black">{initials(selectedRoom.name)}</span>
                  ) : (
                    (() => {
                      const Icon = roomIcon(selectedRoom);
                      return <Icon size={26} />;
                    })()
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-black text-slate-950">{selectedRoom.name}</h2>
                  <p className="mt-1 truncate text-base text-slate-500">{selectedRoom.description}</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 sm:flex">
                <CheckCircle2 size={16} />
                Serviço real
              </div>
            </header>

            {error && (
              <div className="mx-8 mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700">
                {error}
              </div>
            )}

            <section className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc,#eef2f7)] px-8 py-8">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center text-base text-slate-500">A carregar mensagens...</div>
              ) : selectedMessages.length === 0 ? (
                <div className="mx-auto mt-24 max-w-lg rounded-3xl border border-dashed border-slate-300 bg-white/80 p-10 text-center shadow-sm backdrop-blur">
                  <MessageCircle className="mx-auto text-slate-300" size={52} />
                  <h3 className="mt-5 text-2xl font-black text-slate-950">Sem mensagens</h3>
                  <p className="mt-3 text-base text-slate-500">
                    Esta conversa ainda não tem histórico real. Envia a primeira mensagem para criar registo na base de dados.
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-5">
                  {selectedMessages.map((message) => {
                    const own = String(user?.id ?? '') === String(message.sender_id);

                    return (
                      <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[min(48rem,78%)] rounded-[1.75rem] px-5 py-4 shadow-sm ${own ? 'bg-blue-600 text-white' : 'bg-white text-slate-900'}`}>
                          {!own && <p className="mb-1.5 text-sm font-bold text-slate-500">{message.sender_name}</p>}
                          <p className="whitespace-pre-wrap text-base leading-7 xl:text-lg">{message.text}</p>
                          <p className={`mt-3 text-right text-xs ${own ? 'text-blue-100' : 'text-slate-400'}`}>
                            {formatDateTime(message.ts)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </section>

            <form onSubmit={handleSend} className="border-t border-slate-200 bg-white p-6">
              <div className="mx-auto flex max-w-6xl items-end gap-4">
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Escrever mensagem operacional..."
                  rows={1}
                  className="max-h-44 min-h-[4rem] flex-1 resize-none rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 xl:text-lg"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Enviar"
                >
                  {sending ? <RefreshCw className="animate-spin" size={22} /> : <Send size={22} />}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-slate-50 px-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white text-slate-300 shadow-sm">
                <MessageCircle size={44} />
              </div>
              <h2 className="mt-6 text-3xl font-black text-slate-950">Seleciona uma conversa</h2>
              <p className="mt-3 text-base text-slate-500">
                Escolhe um canal operacional ou uma conversa direta com um elemento real da equipa.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
