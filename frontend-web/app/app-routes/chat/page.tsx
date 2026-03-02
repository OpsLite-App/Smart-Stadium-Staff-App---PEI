// app/app-routes/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/lib/stores/useAuthStore';
import { AUTH_SERVICE, CHAT_SERVICE } from '@/lib/services/api';
import axios from 'axios';
import {
  MessageSquare,
  Send,
  Archive,
  Users,
  User,
  AlertCircle,
  Paperclip,
  File,
  Bell,
  Image,
  Mic,
  MoreVertical,
  Search,
  Info,
  Check,
  CheckCheck,
  Clock,
  Wifi,
  WifiOff,
  XCircle,
  Pin,
  BellOff,
  Trash2,
  Edit,
  Reply,
  Copy,
  Download,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';

// Message types
interface Message {
  id: string;
  chat_id: string;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'alert' | 'system';
  timestamp: string;
  read_by: number[];
  delivered_to: number[];
  replied_to?: {
    id: string;
    content: string;
    sender_name: string;
  };
  edited: boolean;
  edited_at?: string;
  deleted: boolean;
  pinned: boolean;
  attachments?: {
    id: string;
    type: 'image' | 'pdf' | 'doc';
    url: string;
    name: string;
    size: number;
  }[];
  metadata?: Record<string, unknown>;
}

// Chat types
interface Chat {
  id: string;
  type: 'direct' | 'group' | 'channel' | 'emergency';
  name: string;
  avatar?: string;
  participants: ChatParticipant[];
  last_message?: {
    content: string;
    timestamp: string;
    sender_name: string;
  };
  unread_count: number;
  pinned: boolean;
  muted: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  topic?: string;
  description?: string;
  emergency_level?: 'critical' | 'high' | 'medium' | 'low';
}

// Chat participant
interface ChatParticipant {
  id: number;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string;
  typing: boolean;
  typing_in?: string;
}

// WebSocket types
interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'delivered' | 'presence' | 'reaction';
  chat_id: string;
  sender_id: number;
  data: Record<string, unknown>;
  timestamp: string;
}

// Contact for a new conversation
interface Contact {
  id: number;
  name: string;
  role: string;
  status: 'online' | 'offline' | 'away';
  last_seen: string;
  avatar?: string;
}

interface ChatApiMessage {
  id: number;
  room: string;
  sender_id: string;
  sender_name: string;
  text: string;
  ts: string;
}

interface StaffApiUser {
  id: number;
  name?: string;
  email?: string;
  username?: string;
  role?: string;
  status?: string | null;
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [wsConnected, setWsConnected] = useState<boolean | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [chatApiDisabledUntil, setChatApiDisabledUntil] = useState<number>(0);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [filters, setFilters] = useState({
    unreadOnly: false,
    pinnedOnly: false,
    emergencyOnly: false
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatApiErrorLoggedRef = useRef(false);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load local conversations (until backend chat listing endpoint exists)
  const fetchChats = async () => {
    try {
      console.log('💬 Loading local conversations...');
      
      const mockChats = generateMockChats();
      
      setChats(mockChats);
      setFilteredChats(mockChats);

      const online = mockChats.reduce((acc, chat) => {
        return acc + chat.participants.filter(p => p.status === 'online').length;
      }, 0);
      setOnlineCount(online);
      
      setLoading(false);

    } catch (error) {
      console.error('❌ Error while loading chats:', error);
      const mockChats = generateMockChats();
      setChats(mockChats);
      setFilteredChats(mockChats);
      setLoading(false);
    }
  };

  const mapStaffStatusToContactStatus = (status?: string | null): Contact['status'] => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active') return 'online';
    if (normalized === 'patrol' || normalized === 'break') return 'away';
    return 'offline';
  };

  // Load real contacts
  const fetchContacts = async () => {
    try {
      console.log(`👥 Loading real contacts from ${AUTH_SERVICE}/staff...`);

      const response = await axios.get<StaffApiUser[]>(`${AUTH_SERVICE}/staff`, {
        timeout: 5000,
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
      });

      const contactList: Contact[] = response.data
        .filter((staff) => typeof staff.id === 'number' && staff.id !== user?.id)
        .map((staff) => ({
          id: staff.id,
          name: staff.name || staff.username || staff.email || `User ${staff.id}`,
          role: staff.role || 'Staff',
          status: mapStaffStatusToContactStatus(staff.status),
          last_seen: new Date().toISOString(),
        }));

      setContacts(contactList);
      console.log(`✅ Real contacts loaded: ${contactList.length}`);
    } catch (error) {
      console.error('❌ Error while loading real contacts:', error);
      setContacts([]);
    }
  };

  const mapApiMessageToUi = (message: ChatApiMessage): Message => {
    const senderId = Number.parseInt(message.sender_id, 10);
    return {
      id: String(message.id),
      chat_id: message.room,
      sender_id: Number.isNaN(senderId) ? 0 : senderId,
      sender_name: message.sender_name,
      sender_role: 'Staff',
      content: message.text,
      type: 'text',
      timestamp: message.ts,
      read_by: [],
      delivered_to: [],
      edited: false,
      deleted: false,
      pinned: false,
    };
  };

  const canUseChatApi = () => Date.now() >= chatApiDisabledUntil;
  const getDirectRoomId = (userAId: number, userBId: number) => {
    const [low, high] = [userAId, userBId].sort((a, b) => a - b);
    return `dm-${low}-${high}`;
  };
  const resolveRoomId = (chat: Chat) => {
    if (chat.type !== 'direct' || !user?.id) return chat.id;
    const peer = chat.participants.find((p) => p.id !== user.id);
    if (!peer) return chat.id;
    return getDirectRoomId(user.id, peer.id);
  };

  // Load messages for a chat
  const fetchMessages = async (chatId: string, options?: { showLoader?: boolean }) => {
    const shouldShowLoader = options?.showLoader ?? true;
    if (!canUseChatApi()) {
      setWsConnected(false);
      setUsingMockData(true);
      if (shouldShowLoader) {
        setMessages(generateMockMessages(chatId));
        setLoading(false);
      }
      return;
    }

    try {
      if (shouldShowLoader) {
        setLoading(true);
      }

      console.log(`📨 Loading real messages for chat ${chatId}...`);
      const response = await axios.get<ChatApiMessage[]>(`${CHAT_SERVICE}/messages/${chatId}`, {
        timeout: 8000,
      });

      const messageList = [...response.data]
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
        .map(mapApiMessageToUi);

      setMessages(messageList);
      setWsConnected(true);
      setUsingMockData(false);
      chatApiErrorLoggedRef.current = false;
      
      if (user) {
        setChats(prev => 
          prev.map(c => 
            c.id === chatId
              ? {
                  ...c,
                  unread_count: 0,
                  updated_at: messageList.at(-1)?.timestamp || c.updated_at,
                  last_message: messageList.at(-1)
                    ? {
                        content: messageList.at(-1)!.content,
                        timestamp: messageList.at(-1)!.timestamp,
                        sender_name: messageList.at(-1)!.sender_name,
                      }
                    : c.last_message,
                }
              : c
          )
        );
      }

    } catch (error) {
      if (!chatApiErrorLoggedRef.current) {
        console.warn('⚠️ Chat Service unavailable, falling back to mock:', error);
        chatApiErrorLoggedRef.current = true;
      }
      setWsConnected(false);
      setUsingMockData(true);
      setChatApiDisabledUntil(Date.now() + 60_000);
      setMessages(generateMockMessages(chatId));
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
      }
    }
  };

  // Mark messages as read
  const markMessagesAsRead = (chatId: string, messageList: Message[]) => {
    if (!user) return;

    const unreadMessages = messageList.filter(m => 
      !m.read_by.includes(user.id || 0) && m.sender_id !== user.id
    );

    if (unreadMessages.length > 0) {
      setMessages(prev => 
        prev.map(m => 
          !m.read_by.includes(user.id || 0) && m.sender_id !== user.id
            ? { ...m, read_by: [...m.read_by, user.id || 0] }
            : m
        )
      );

      setChats(prev => 
        prev.map(c => 
          c.id === chatId 
            ? { ...c, unread_count: 0 }
            : c
        )
      );
    }
  };

  // Generate mock chats
  const generateMockChats = (): Chat[] => {
    const now = new Date();
    
    return [
      {
        id: 'chat-1',
        type: 'group',
        name: 'Equipa de Segurança',
        participants: [
          { id: 1, name: 'Ana Silva', role: 'Security', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 2, name: 'João Santos', role: 'Security', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 3, name: 'Carlos Rodrigues', role: 'Security', status: 'away', last_seen: now.toISOString(), typing: false },
          { id: 4, name: 'Tiago Fernandes', role: 'Security', status: 'offline', last_seen: now.toISOString(), typing: false },
        ],
        last_message: {
          content: 'Alguém viu movimento suspeito no Setor A?',
          timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
          sender_name: 'Ana Silva'
        },
        unread_count: 3,
        pinned: true,
        muted: false,
        archived: false,
        created_at: new Date(now.getTime() - 30 * 24 * 60 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 5 * 60000).toISOString(),
        created_by: 1,
        topic: 'Coordenação de Segurança'
      },
      {
        id: 'chat-2',
        type: 'group',
        name: 'Equipa de Limpeza',
        participants: [
          { id: 5, name: 'Maria Oliveira', role: 'Cleaning', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 6, name: 'Inês Pereira', role: 'Cleaning', status: 'busy', last_seen: now.toISOString(), typing: false },
          { id: 7, name: 'Catarina Gomes', role: 'Cleaning', status: 'online', last_seen: now.toISOString(), typing: false },
        ],
        last_message: {
          content: 'Lixeiras do Setor VIP precisam de atenção',
          timestamp: new Date(now.getTime() - 15 * 60000).toISOString(),
          sender_name: 'Maria Oliveira'
        },
        unread_count: 0,
        pinned: false,
        muted: false,
        archived: false,
        created_at: new Date(now.getTime() - 25 * 24 * 60 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 15 * 60000).toISOString(),
        created_by: 5
      },
      {
        id: 'chat-3',
        type: 'emergency',
        name: 'EMERGÊNCIA - Canal 1',
        participants: [
          { id: 1, name: 'Ana Silva', role: 'Security', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 2, name: 'João Santos', role: 'Security', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 8, name: 'Pedro Costa', role: 'Supervisor', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 9, name: 'Sofia Ferreira', role: 'Medical', status: 'online', last_seen: now.toISOString(), typing: false },
        ],
        last_message: {
          content: '🚨 EVACUAÇÃO NECESSÁRIA NO SETOR A4',
          timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
          sender_name: 'Sistema'
        },
        unread_count: 5,
        pinned: true,
        muted: false,
        archived: false,
        created_at: new Date(now.getTime() - 60 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 2 * 60000).toISOString(),
        created_by: 0,
        emergency_level: 'critical'
      },
      {
        id: 'chat-4',
        type: 'direct',
        name: 'Ana Silva',
        participants: [
          { id: 1, name: 'Ana Silva', role: 'Security', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: user?.id || 10, name: user?.email?.split('@')[0] || 'Eu', role: user?.role || 'Staff', status: 'online', last_seen: now.toISOString(), typing: false },
        ],
        last_message: {
          content: 'OK, vou verificar as câmaras',
          timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
          sender_name: 'Ana Silva'
        },
        unread_count: 1,
        pinned: false,
        muted: false,
        archived: false,
        created_at: new Date(now.getTime() - 15 * 24 * 60 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 25 * 60000).toISOString(),
        created_by: user?.id || 10
      },
      {
        id: 'chat-5',
        type: 'channel',
        name: 'Anúncios Gerais',
        participants: [
          { id: 8, name: 'Pedro Costa', role: 'Supervisor', status: 'online', last_seen: now.toISOString(), typing: false },
          { id: 11, name: 'Rui Almeida', role: 'Supervisor', status: 'away', last_seen: now.toISOString(), typing: false },
        ],
        last_message: {
          content: 'Reunião de staff às 15:00 na sala de controlo',
          timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
          sender_name: 'Pedro Costa'
        },
        unread_count: 0,
        pinned: true,
        muted: true,
        archived: false,
        created_at: new Date(now.getTime() - 40 * 24 * 60 * 60000).toISOString(),
        updated_at: new Date(now.getTime() - 45 * 60000).toISOString(),
        created_by: 8,
        description: 'Canal para comunicados oficiais'
      }
    ];
  };

  // Generate mock messages
  const generateMockMessages = (chatId: string): Message[] => {
    const now = new Date();
    const messages: Message[] = [];

    if (chatId === 'chat-1') {
      messages.push(
        {
          id: '101',
          chat_id: 'chat-1',
          sender_id: 1,
          sender_name: 'Ana Silva',
          sender_role: 'Security',
          content: 'Bom dia equipa! Alguma novidade?',
          type: 'text',
          timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
          read_by: [1, 2, 3, 4],
          delivered_to: [1, 2, 3, 4],
          edited: false,
          deleted: false,
          pinned: false
        },
        {
          id: '102',
          chat_id: 'chat-1',
          sender_id: 2,
          sender_name: 'João Santos',
          sender_role: 'Security',
          content: 'Tudo tranquilo no Setor B',
          type: 'text',
          timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
          read_by: [1, 2, 3, 4],
          delivered_to: [1, 2, 3, 4],
          edited: false,
          deleted: false,
          pinned: false
        },
        {
          id: '103',
          chat_id: 'chat-1',
          sender_id: 3,
          sender_name: 'Carlos Rodrigues',
          sender_role: 'Security',
          content: 'Movimento normal no Setor C',
          type: 'text',
          timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
          read_by: [1, 2, 3],
          delivered_to: [1, 2, 3, 4],
          edited: false,
          deleted: false,
          pinned: false
        }
      );
    } else if (chatId === 'chat-2') {
      messages.push(
        {
          id: '201',
          chat_id: 'chat-2',
          sender_id: 5,
          sender_name: 'Maria Oliveira',
          sender_role: 'Cleaning',
          content: 'Bom dia equipa! Vamos às lixeiras?',
          type: 'text',
          timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
          read_by: [5, 6, 7],
          delivered_to: [5, 6, 7],
          edited: false,
          deleted: false,
          pinned: false
        },
        {
          id: '202',
          chat_id: 'chat-2',
          sender_id: 6,
          sender_name: 'Inês Pereira',
          sender_role: 'Cleaning',
          content: 'Já estou no Setor B, lixeiras ok',
          type: 'text',
          timestamp: new Date(now.getTime() - 20 * 60000).toISOString(),
          read_by: [5, 6],
          delivered_to: [5, 6, 7],
          edited: false,
          deleted: false,
          pinned: false
        }
      );
    } else if (chatId === 'chat-3') {
      messages.push(
        {
          id: '301',
          chat_id: 'chat-3',
          sender_id: 0,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: '🚨 **ALERTA DE EMERGÊNCIA** 🚨\n\nIncêndio detetado no Setor A4. Evacuação imediata necessária.',
          type: 'alert',
          timestamp: new Date(now.getTime() - 2 * 60000).toISOString(),
          read_by: [],
          delivered_to: [],
          edited: false,
          deleted: false,
          pinned: true,
          metadata: {
            severity: 'critical',
            location: 'Setor A4',
            instructions: ['Evacuar imediatamente', 'Usar saídas de emergência', 'Manter calma']
          }
        }
      );
    } else if (chatId === 'chat-4') {
      messages.push(
        {
          id: '401',
          chat_id: 'chat-4',
          sender_id: 1,
          sender_name: 'Ana Silva',
          sender_role: 'Security',
          content: 'Preciso de ajuda no Setor A',
          type: 'text',
          timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
          read_by: [1, user?.id || 0],
          delivered_to: [1, user?.id || 0],
          edited: false,
          deleted: false,
          pinned: false
        },
        {
          id: '403',
          chat_id: 'chat-4',
          sender_id: 1,
          sender_name: 'Ana Silva',
          sender_role: 'Security',
          content: 'OK, vou verificar as câmaras',
          type: 'text',
          timestamp: new Date(now.getTime() - 25 * 60000).toISOString(),
          read_by: [1, user?.id || 0],
          delivered_to: [1, user?.id || 0],
          edited: false,
          deleted: false,
          pinned: false
        }
      );
    } else if (chatId === 'chat-5') {
      messages.push(
        {
          id: '501',
          chat_id: 'chat-5',
          sender_id: 8,
          sender_name: 'Pedro Costa',
          sender_role: 'Supervisor',
          content: 'Reunião de staff às 15:00 na sala de controlo',
          type: 'text',
          timestamp: new Date(now.getTime() - 120 * 60000).toISOString(),
          read_by: [8, 11],
          delivered_to: [8, 11],
          edited: false,
          deleted: false,
          pinned: true
        }
      );
    }

    return messages;
  };

  // Send message
  const sendMessage = async () => {
    if (!selectedChat || !newMessage.trim() || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_id: selectedChat.id,
      sender_id: user.id || 0,
      sender_name: user.email?.split('@')[0] || 'Staff',
      sender_role: user.role,
      content: messageContent,
      type: 'text',
      timestamp: new Date().toISOString(),
      read_by: [user.id || 0],
      delivered_to: [],
      edited: false,
      deleted: false,
      pinned: false,
      replied_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        sender_name: replyingTo.sender_name
      } : undefined
    };

    setMessages(prev => [...prev, tempMessage]);

    if (replyingTo) {
      setReplyingTo(null);
    }

    if (!canUseChatApi()) {
      setWsConnected(false);
      setUsingMockData(true);
      setSending(false);
      return;
    }

    try {
      const response = await axios.post<ChatApiMessage>(
        `${CHAT_SERVICE}/messages/`,
        {
          room: selectedChat.id,
          sender_id: String(user.id || 0),
          sender_name: user.email?.split('@')[0] || 'Staff',
          text: messageContent,
        },
        { timeout: 8000 }
      );

      const persisted = mapApiMessageToUi(response.data);
      setMessages(prev =>
        prev.map(m => (m.id === tempMessage.id ? persisted : m))
      );

      setChats(prev =>
        prev.map(chat =>
          chat.id === selectedChat.id
            ? {
                ...chat,
                updated_at: persisted.timestamp,
                last_message: {
                  content: persisted.content,
                  timestamp: persisted.timestamp,
                  sender_name: persisted.sender_name,
                },
              }
            : chat
        )
      );

      setWsConnected(true);
      setUsingMockData(false);
      chatApiErrorLoggedRef.current = false;
    } catch (error) {
      if (!chatApiErrorLoggedRef.current) {
        console.error('❌ Error while sending message:', error);
        chatApiErrorLoggedRef.current = true;
      }
      setWsConnected(false);
      setUsingMockData(true);
      setChatApiDisabledUntil(Date.now() + 60_000);
    } finally {
      setSending(false);
    }
  };

  // Send typing indicator (mock)
  const sendTyping = () => {};

  // Stop typing (mock)
  const stopTyping = () => {};

  // Select chat
  const handleSelectChat = (chat: Chat) => {
    const roomId = resolveRoomId(chat);
    const resolvedChat = roomId === chat.id ? chat : { ...chat, id: roomId };

    setMessages([]);
    setTypingUsers(new Map());
    setReplyingTo(null);
    setEditingMessage(null);
    setShowPinned(false);
    
    setSelectedChat(resolvedChat);
    fetchMessages(roomId);
    
    setChats(prev =>
      prev.map(c =>
        c.id === chat.id || c.id === roomId
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  };

  // Start conversation with a contact
  const startConversation = (contact: Contact) => {
    if (!user?.id) {
      console.error('❌ Could not start conversation: missing user.id');
      return;
    }

    const directRoomId = getDirectRoomId(user.id, contact.id);
    const existingChat = chats.find(c => c.id === directRoomId);

    if (existingChat) {
      handleSelectChat(existingChat);
      setShowContacts(false);
      return;
    }

    const newChat: Chat = {
      id: directRoomId,
      type: 'direct',
      name: contact.name,
      participants: [
        { 
          id: contact.id, 
          name: contact.name, 
          role: contact.role, 
          status: contact.status, 
          last_seen: contact.last_seen,
          typing: false 
        },
        { 
          id: user.id, 
          name: user.email?.split('@')[0] || 'Eu', 
          role: user.role || 'Staff', 
          status: 'online', 
          last_seen: new Date().toISOString(),
          typing: false 
        }
      ],
      unread_count: 0,
      pinned: false,
      muted: false,
      archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user.id
    };

    setChats(prev => [newChat, ...prev]);
    handleSelectChat(newChat);

    setShowContacts(false);
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...chats];

    if (filters.unreadOnly) {
      filtered = filtered.filter(c => c.unread_count > 0);
    }

    if (filters.pinnedOnly) {
      filtered = filtered.filter(c => c.pinned);
    }

    if (filters.emergencyOnly) {
      filtered = filtered.filter(c => c.type === 'emergency');
    }

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.participants.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    setFilteredChats(filtered);
  }, [chats, filters, searchTerm]);

  // Load initial data
  useEffect(() => {
    fetchChats();
    fetchContacts();
  }, []);

  // Periodic refresh for active conversation
  useEffect(() => {
    if (!selectedChat) return;

    if (!canUseChatApi()) return;

    const intervalId = setInterval(() => {
      fetchMessages(selectedChat.id, { showLoader: false });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [selectedChat, chatApiDisabledUntil]);

  // Immediate refresh when returning to tab/app
  useEffect(() => {
    if (!selectedChat) return;

    const refreshNow = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages(selectedChat.id, { showLoader: false });
      }
    };

    window.addEventListener('focus', refreshNow);
    document.addEventListener('visibilitychange', refreshNow);
    return () => {
      window.removeEventListener('focus', refreshNow);
      document.removeEventListener('visibilitychange', refreshNow);
    };
  }, [selectedChat, chatApiDisabledUntil]);

  // Format time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} h`;
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  };

  // Get chat type icon
  const getChatIcon = (chat: Chat) => {
    switch (chat.type) {
      case 'direct': return User;
      case 'group': return Users;
      case 'channel': return MessageSquare;
      case 'emergency': return AlertCircle;
      default: return MessageSquare;
    }
  };

  // Get chat type color
  const getChatColor = (chat: Chat) => {
    switch (chat.type) {
      case 'direct': return 'text-blue-600 bg-blue-100';
      case 'group': return 'text-green-600 bg-green-100';
      case 'channel': return 'text-purple-600 bg-purple-100';
      case 'emergency': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  if (loading && !selectedChat) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4F46E5] mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar chat...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Chats sidebar */}
        <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} md:w-80 flex-col border-r border-gray-200 bg-white`}>
          {/* Sidebar header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Mensagens</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowContacts(!showContacts)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="Nova conversa"
                >
                  <Users size={20} />
                </button>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="Configurações"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>

            {/* WebSocket status */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {wsConnected === null ? (
                  <>
                    <WifiOff size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-500">Abrir conversa para ligar</span>
                  </>
                ) : wsConnected ? (
                  <>
                    <Wifi size={14} className="text-green-600" />
                    <span className="text-xs text-green-600">Chat API ligada</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={14} className="text-red-600" />
                    <span className="text-xs text-red-600">{usingMockData ? 'Fallback local' : 'Chat API offline'}</span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-600">{onlineCount} online</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Pesquisar conversas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
              />
            </div>
          </div>

          {/* Quick filters */}
          <div className="px-4 py-2 flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setFilters(prev => ({ ...prev, unreadOnly: !prev.unreadOnly }))}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                filters.unreadOnly
                  ? 'bg-[#4F46E5] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Não lidos
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, pinnedOnly: !prev.pinnedOnly }))}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                filters.pinnedOnly
                  ? 'bg-[#4F46E5] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fixados
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, emergencyOnly: !prev.emergencyOnly }))}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                filters.emergencyOnly
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Emergência
            </button>
          </div>

          {/* Contacts list */}
          {showContacts && (
            <div className="p-4 border-b border-gray-200 max-h-60 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Contactos</h3>
              <div className="space-y-2">
                {contacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => startConversation(contact)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-sm">
                        {contact.name.charAt(0)}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusColor(contact.status)}`}></span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                      <p className="text-xs text-gray-600">{contact.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chats list */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare size={32} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredChats.map(chat => {
                const ChatIcon = getChatIcon(chat);
                const chatColor = getChatColor(chat);
                const lastMessageTime = chat.last_message ? formatTime(chat.last_message.timestamp) : '';

                return (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      selectedChat?.id === chat.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${chatColor}`}>
                      <ChatIcon size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {chat.name}
                          {chat.type === 'emergency' && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-600 text-white rounded">
                              SOS
                            </span>
                          )}
                        </h3>
                        {chat.last_message && (
                          <span className="text-xs text-gray-500">{lastMessageTime}</span>
                        )}
                      </div>

                      {chat.last_message && (
                        <p className="text-sm text-gray-600 truncate">
                          <span className="text-xs text-gray-400">
                            {chat.last_message.sender_name}:
                          </span>{' '}
                          {chat.last_message.content}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex -space-x-1">
                          {chat.participants.slice(0, 3).map(p => (
                            <div
                              key={p.id}
                              className="w-5 h-5 rounded-full bg-gray-200 border border-white flex items-center justify-center text-[8px] font-medium"
                              title={p.name}
                            >
                              {p.name.charAt(0)}
                            </div>
                          ))}
                          {chat.participants.length > 3 && (
                            <div className="w-5 h-5 rounded-full bg-gray-300 border border-white flex items-center justify-center text-[8px] font-medium">
                              +{chat.participants.length - 3}
                            </div>
                          )}
                        </div>

                        {chat.pinned && <Pin size={12} className="text-gray-400" />}
                        {chat.muted && <BellOff size={12} className="text-gray-400" />}
                        {chat.unread_count > 0 && (
                          <span className="ml-auto bg-[#4F46E5] text-white text-xs px-1.5 py-0.5 rounded-full">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className={`flex-1 flex flex-col bg-white ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedChat ? (
            <>
              {/* Chat header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronDown size={20} />
                  </button>

                  <div className={`p-2 rounded-lg ${getChatColor(selectedChat)}`}>
                    {(() => {
                      const Icon = getChatIcon(selectedChat);
                      return <Icon size={20} />;
                    })()}
                  </div>

                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedChat.name}</h2>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">
                        {selectedChat.participants.length} participantes
                      </span>
                      {selectedChat.type === 'emergency' && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded-full">
                          EMERGÊNCIA ATIVA
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPinned(!showPinned)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    title="Mensagens fixadas"
                  >
                    <Pin size={20} />
                  </button>
                  <button
                    onClick={() => setShowChatInfo(!showChatInfo)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    title="Informações do chat"
                  >
                    <Info size={20} />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4F46E5]"></div>
                  </div>
                ) : (
                  <>
                    {typingUsers.size > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        {Array.from(typingUsers.values()).join(', ')} está a escrever...
                      </div>
                    )}

                    {messages.map((message, index) => {
                      const isOwn = message.sender_id === user?.id;
                      const showAvatar = index === 0 || messages[index - 1]?.sender_id !== message.sender_id;
                      const isPinned = pinnedMessages.some(p => p.id === message.id);

                      return (
                        <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex gap-2 max-w-[70%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                            {!isOwn && showAvatar && (
                              <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-sm flex-shrink-0">
                                {message.sender_name.charAt(0)}
                              </div>
                            )}
                            {!isOwn && !showAvatar && <div className="w-8 flex-shrink-0"></div>}

                            <div>
                              {showAvatar && !isOwn && (
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">{message.sender_name}</span>
                                  <span className="text-xs text-gray-500">{message.sender_role}</span>
                                </div>
                              )}

                              {message.replied_to && (
                                <div className="mb-1 p-2 bg-gray-100 rounded-lg text-sm border-l-2 border-[#4F46E5]">
                                  <p className="text-xs text-gray-600 mb-1">Respondendo a {message.replied_to.sender_name}</p>
                                  <p className="text-gray-700">{message.replied_to.content}</p>
                                </div>
                              )}

                              <div className={`p-3 rounded-lg ${
                                message.type === 'alert'
                                  ? 'bg-red-600 text-white'
                                  : isOwn
                                  ? 'bg-[#4F46E5] text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}>
                                {message.type === 'alert' ? (
                                  <div className="whitespace-pre-line font-bold">{message.content}</div>
                                ) : (
                                  <p className="whitespace-pre-wrap">{message.content}</p>
                                )}

                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {message.attachments.map(att => (
                                      <div key={att.id} className="flex items-center gap-2 p-2 bg-black bg-opacity-10 rounded">
                                        {att.type === 'image' ? <Image size={16} /> : <Paperclip size={16} />}
                                        <span className="text-sm">{att.name}</span>
                                        <button className="ml-auto hover:opacity-75">
                                          <Download size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                                  message.type === 'alert' || isOwn ? 'text-white text-opacity-70' : 'text-gray-500'
                                }`}>
                                  <span>{formatTime(message.timestamp)}</span>
                                  {isOwn && (
                                    <span>
                                      {message.read_by.length > 1 ? <CheckCheck size={14} /> : 
                                       message.delivered_to.length > 0 ? <Check size={14} /> : <Clock size={14} />}
                                    </span>
                                  )}
                                  {isPinned && <Pin size={12} className="ml-1" />}
                                </div>
                              </div>

                              <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'justify-end' : ''}`}>
                                <button onClick={() => setReplyingTo(message)} className="p-1 hover:bg-gray-100 rounded" title="Responder">
                                  <Reply size={14} className="text-gray-500" />
                                </button>
                                <button className="p-1 hover:bg-gray-100 rounded" title="Copiar">
                                  <Copy size={14} className="text-gray-500" />
                                </button>
                                {isOwn && (
                                  <button onClick={() => setEditingMessage(message)} className="p-1 hover:bg-gray-100 rounded" title="Editar">
                                    <Edit size={14} className="text-gray-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Reply preview */}
              {replyingTo && (
                <div className="px-6 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 mb-1">Responder a {replyingTo.sender_name}</p>
                    <p className="text-sm text-gray-700 truncate">{replyingTo.content}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 rounded">
                    <XCircle size={18} className="text-gray-500" />
                  </button>
                </div>
              )}

              {/* Message input */}
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  >
                    <Paperclip size={20} />
                  </button>

                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Escreva uma mensagem..."
                      rows={1}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="p-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={20} />
                  </button>
                </div>

                {showAttachMenu && (
                  <div className="absolute bottom-20 left-6 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
                    <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg w-full">
                      <Image size={18} className="text-gray-600" />
                      <span className="text-sm">Imagem</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg w-full">
                      <Mic size={18} className="text-gray-600" />
                      <span className="text-sm">Áudio</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg w-full">
                      <File size={18} className="text-gray-600" />
                      <span className="text-sm">Documento</span>
                    </button>
                  </div>
                )}

                <input type="file" ref={fileInputRef} className="hidden" />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma conversa selecionada</h3>
                <p className="text-gray-500 mb-4">Escolha uma conversa para começar a trocar mensagens</p>
                <button
                  onClick={() => setShowContacts(true)}
                  className="px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA]"
                >
                  Nova conversa
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat info sidebar */}
        {showChatInfo && selectedChat && (
          <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Informações</h3>
              <button onClick={() => setShowChatInfo(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Participantes ({selectedChat.participants.length})</h4>
              <div className="space-y-3">
                {selectedChat.participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-sm">
                          {p.name.charAt(0)}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusColor(p.status)}`}></span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-600">{p.role}</p>
                      </div>
                    </div>
                    {p.typing && <span className="text-xs text-gray-500">a escrever...</span>}
                  </div>
                ))}
              </div>
            </div>

            {selectedChat.topic && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tópico</h4>
                <p className="text-sm text-gray-600">{selectedChat.topic}</p>
              </div>
            )}

            {selectedChat.description && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Descrição</h4>
                <p className="text-sm text-gray-600">{selectedChat.description}</p>
              </div>
            )}

            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm text-gray-700">
                <Bell size={16} />
                {selectedChat.muted ? 'Ativar notificações' : 'Silenciar notificações'}
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm text-gray-700">
                <Pin size={16} />
                {selectedChat.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm text-gray-700">
                <Archive size={16} />
                {selectedChat.archived ? 'Desarquivar' : 'Arquivar'}
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg text-sm text-red-600">
                <Trash2 size={16} />
                Apagar conversa
              </button>
            </div>
          </div>
        )}

        {/* Pinned messages sidebar */}
        {showPinned && selectedChat && (
          <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Mensagens Fixadas</h3>
              <button onClick={() => setShowPinned(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle size={18} className="text-gray-500" />
              </button>
            </div>

            {pinnedMessages.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma mensagem fixada</p>
            ) : (
              <div className="space-y-3">
                {pinnedMessages.map(msg => (
                  <div key={msg.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{msg.sender_name}</p>
                    <p className="text-sm text-gray-700 mt-1">{msg.content}</p>
                    <p className="text-xs text-gray-500 mt-2">{formatTime(msg.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
