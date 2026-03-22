import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';
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
  filteredGroups: ChatGroup[]; // ✅ Novo: grupos filtrados por role
  activeGroupId: string | null;
  onlineUsers: string[];
  
  sendMessage: (text: string, groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  markAsRead: (groupId: string) => void;
  addGroup: (group: Omit<ChatGroup, 'id' | 'unreadCount'>) => void;
  toggleUserOnline: (userId: string) => void;
  filterGroupsByRole: (role: string) => void; // ✅ Nova função
}

// Grupos base (todos os canais disponíveis)
const ALL_GROUPS: ChatGroup[] = [
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
    name: 'Seguranca',
    description: 'Equipa de seguranca e vigilancia',
    members: [],
    icon: 'shield-account',
    color: '#3B82F6',
    unreadCount: 3,
  },
  {
    id: 'cleaning',
    name: 'Limpeza',
    description: 'Equipa de limpeza e manutencao',
    members: [],
    icon: 'broom',
    color: '#10B981',
    unreadCount: 2,
  },
  {
    id: 'medical',
    name: 'Medicos',
    description: 'Equipa medica e emergencia',
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

// ✅ Mapeamento de roles para canais permitidos
const ROLE_GROUPS: Record<string, string[]> = {
  Security: ['all', 'security', 'supervisors'],
  Cleaning: ['all', 'cleaning', 'supervisors'],
  Supervisor: ['all', 'security', 'cleaning', 'medical', 'supervisors'],
  Medical: ['all', 'medical', 'supervisors'], // ✅ Médico só vê Geral, Médicos e Supervisores
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Equipa medica a caminho do setor 12',
    senderId: 'med1',
    senderName: 'Dr. Silva',
    senderRole: 'Supervisor',
    timestamp: new Date(Date.now() - 3600000), 
    groupId: 'all',
    read: true,
  },
  {
    id: '2',
    text: 'Lixeira B03 cheia na area comercial',
    senderId: 'clean2',
    senderName: 'Maria Santos',
    senderRole: 'Cleaning',
    timestamp: new Date(Date.now() - 1800000), 
    groupId: 'cleaning',
    read: false,
  },
  {
    id: '3',
    text: 'Situacao controlada na saida sul',
    senderId: 'sec1',
    senderName: 'Joao Silva',
    senderRole: 'Security',
    timestamp: new Date(Date.now() - 900000), 
    groupId: 'security',
    read: false,
  },
  {
    id: '4',
    text: 'Alguem na zona do Gate 5?',
    senderId: 'sup1',
    senderName: 'Carlos Chefe',
    senderRole: 'Supervisor',
    timestamp: new Date(Date.now() - 300000), 
    groupId: 'all',
    read: true,
  },
  {
    id: '5',
    text: 'Preciso de apoio médico no Setor A4',
    senderId: 'sec2',
    senderName: 'Ana Silva',
    senderRole: 'Security',
    timestamp: new Date(Date.now() - 60000),
    groupId: 'medical',
    read: false,
  },
];

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: INITIAL_MESSAGES,
      groups: ALL_GROUPS,
      filteredGroups: [], // ✅ Inicialmente vazio
      activeGroupId: null,
      onlineUsers: ['sec1', 'sup1', 'clean2', 'med2'],

      // ✅ Nova função para filtrar grupos por role
      filterGroupsByRole: (role: string) => {
        const allowedGroupIds = ROLE_GROUPS[role] || ['all'];
        const filtered = get().groups.filter(group => allowedGroupIds.includes(group.id));
        set({ filteredGroups: filtered });
        
        // Se o grupo ativo não estiver na lista, limpar
        const activeGroup = get().activeGroupId;
        if (activeGroup && !allowedGroupIds.includes(activeGroup)) {
          set({ activeGroupId: filtered[0]?.id || null });
        }
      },

      sendMessage: (text, groupId) => {
        let userName = 'Usuario';
        let userRole: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical' = 'Security';

        const createAndSendMessage = (
          text: string, 
          groupId: string, 
          senderName: string, 
          senderRole: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical'
        ) => {
          const newMessage: Message = {
            id: Date.now().toString(),
            text,
            senderId: 'current-user',
            senderName: senderName,
            senderRole: senderRole,
            timestamp: new Date(),
            groupId,
            read: false,
          };

          const updatedGroups = get().groups.map(group => 
            group.id === groupId 
              ? { ...group, lastMessage: newMessage, unreadCount: group.unreadCount + 1 }
              : group
          );

          // Atualizar também os filteredGroups
          const updatedFiltered = get().filteredGroups.map(group =>
            group.id === groupId
              ? { ...group, lastMessage: newMessage, unreadCount: group.unreadCount + 1 }
              : group
          );

          set(state => ({
            messages: [...state.messages, newMessage],
            groups: updatedGroups,
            filteredGroups: updatedFiltered,
          }));

          if (groupId === 'all' && text.toLowerCase().includes('emergencia')) {
            setTimeout(() => {
              const autoReply: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Emergencia registrada. Equipa a caminho.',
                senderId: 'system',
                senderName: 'Sistema',
                senderRole: 'Supervisor',
                timestamp: new Date(),
                groupId,
                read: false,
              };
              set(state => ({ 
                messages: [...state.messages, autoReply],
                filteredGroups: state.filteredGroups.map(g =>
                  g.id === groupId ? { ...g, lastMessage: autoReply, unreadCount: g.unreadCount + 1 } : g
                )
              }));
            }, 2000);
          }
        };

        if (typeof window !== 'undefined') {
          import('./useAuthStore')
            .then(({ useAuthStore }) => {
              const user = useAuthStore.getState().user;
              if (user) {
                userName = user.email.split('@')[0];
                userRole = user.role as 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';
              }
              createAndSendMessage(text, groupId, userName, userRole);
            })
            .catch(() => {
              createAndSendMessage(text, groupId, userName, userRole);
            });
        } else {
          createAndSendMessage(text, groupId, userName, userRole);
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
          filteredGroups: state.filteredGroups.map(group =>
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
        set(state => ({ 
          groups: [...state.groups, newGroup],
          filteredGroups: [...state.filteredGroups, newGroup]
        }));
      },

      toggleUserOnline: (userId) => {
        set(state => ({
          onlineUsers: state.onlineUsers.includes(userId)
            ? state.onlineUsers.filter(id => id !== userId)
            : [...state.onlineUsers, userId]
        }));
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        messages: state.messages,
        groups: state.groups,
        activeGroupId: state.activeGroupId,
        filteredGroups: state.filteredGroups
      }),
    }
  )
);