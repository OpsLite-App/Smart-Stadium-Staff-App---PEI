import { create } from 'zustand';

export type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: 'Security' | 'Cleaning' | 'Supervisor';
  timestamp: Date;
  groupId: string;
  read: boolean;
};

export type ChatGroup = {
  id: string;
  name: string;
  description: string;
  members: string[]; 
  icon: string;
  color: string;
  lastMessage?: Message;
  unreadCount: number;
};

interface ChatState {
  messages: Message[];
  groups: ChatGroup[];
  activeGroupId: string | null;
  onlineUsers: string[];
  
  sendMessage: (text: string, groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  markAsRead: (groupId: string) => void;
  addGroup: (group: Omit<ChatGroup, 'id' | 'unreadCount'>) => void;
  toggleUserOnline: (userId: string) => void;
}

// Dados mock iniciais
const INITIAL_GROUPS: ChatGroup[] = [
  {
    id: 'all',
    name: 'Geral - Todos',
    description: 'Canal geral para toda a equipa',
    members: [],
    icon: 'account-group',
    color: '#4F46E5',
    unreadCount: 0,
  },
  {
    id: 'security',
    name: 'Segurança',
    description: 'Equipa de segurança e vigilância',
    members: [],
    icon: 'shield-account',
    color: '#3B82F6',
    unreadCount: 3,
  },
  {
    id: 'cleaning',
    name: 'Limpeza',
    description: 'Equipa de limpeza e manutenção',
    members: [],
    icon: 'broom',
    color: '#10B981',
    unreadCount: 2,
  },
  {
    id: 'medical',
    name: 'Médicos',
    description: 'Equipa médica e emergência',
    members: [],
    icon: 'medical-bag',
    color: '#EF4444',
    unreadCount: 1,
  },
  {
    id: 'supervisors',
    name: 'Supervisores',
    description: 'Canal de supervisores',
    members: [],
    icon: 'account-tie',
    color: '#F59E0B',
    unreadCount: 0,
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Equipa médica a caminho do setor 12',
    senderId: 'med1',
    senderName: 'Dr. Silva',
    senderRole: 'Supervisor',
    timestamp: new Date(Date.now() - 3600000), 
    groupId: 'all',
    read: true,
  },
  {
    id: '2',
    text: 'Lixeira B03 cheia na área comercial',
    senderId: 'clean2',
    senderName: 'Maria Santos',
    senderRole: 'Cleaning',
    timestamp: new Date(Date.now() - 1800000), 
    groupId: 'cleaning',
    read: false,
  },
  {
    id: '3',
    text: 'Situação controlada na saída sul',
    senderId: 'sec1',
    senderName: 'João Silva',
    senderRole: 'Security',
    timestamp: new Date(Date.now() - 900000), 
    groupId: 'security',
    read: false,
  },
  {
    id: '4',
    text: 'Alguém na zona do Gate 5?',
    senderId: 'sup1',
    senderName: 'Carlos Chefe',
    senderRole: 'Supervisor',
    timestamp: new Date(Date.now() - 300000), 
    groupId: 'all',
    read: true,
  },
];

export const useChatStore = create<ChatState>((set, get) => ({
  messages: INITIAL_MESSAGES,
  groups: INITIAL_GROUPS,
  activeGroupId: 'all',
  onlineUsers: ['sec1', 'sup1', 'clean2'],

  sendMessage: (text, groupId) => {
    const { user } = require('./useAuthStore').useAuthStore.getState();
    if (!user) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      senderId: 'current-user',
      senderName: user.email.split('@')[0],
      senderRole: user.role,
      timestamp: new Date(),
      groupId,
      read: false,
    };

    const updatedGroups = get().groups.map(group => 
      group.id === groupId 
        ? { ...group, lastMessage: newMessage, unreadCount: group.unreadCount + 1 }
        : group
    );

    set(state => ({
      messages: [...state.messages, newMessage],
      groups: updatedGroups,
    }));

    if (groupId === 'all' && text.toLowerCase().includes('emergência')) {
      setTimeout(() => {
        const autoReply: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Emergência registrada. Equipa a caminho.',
          senderId: 'system',
          senderName: 'Sistema',
          senderRole: 'Supervisor',
          timestamp: new Date(),
          groupId,
          read: false,
        };
        set(state => ({ messages: [...state.messages, autoReply] }));
      }, 2000);
    }
  },

  setActiveGroup: (groupId) => {
    set({ activeGroupId: groupId });
    get().markAsRead(groupId);
  },

  markAsRead: (groupId) => {
    set(state => ({
      groups: state.groups.map(group =>
        group.id === groupId ? { ...group, unreadCount: 0 } : group
      ),
      messages: state.messages.map(msg =>
        msg.groupId === groupId ? { ...msg, read: true } : msg
      ),
    }));
  },

  addGroup: (group) => {
    const newGroup: ChatGroup = {
      ...group,
      id: Date.now().toString(),
      unreadCount: 0,
    };
    set(state => ({ groups: [...state.groups, newGroup] }));
  },

  toggleUserOnline: (userId) => {
    set(state => ({
      onlineUsers: state.onlineUsers.includes(userId)
        ? state.onlineUsers.filter(id => id !== userId)
        : [...state.onlineUsers, userId]
    }));
  },
}));