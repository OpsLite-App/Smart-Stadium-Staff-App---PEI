'use client';

import { useAuthStore } from '@/lib/stores/useAuthStore';
import { DashboardCard } from './DashboardCard';
import { 
  Users, 
  DoorOpen, 
  AlertCircle, 
  MapPin,
  Trash2,
  CheckCircle,
  ClipboardList,
  Timer,
  Shield,
  TrendingUp,
  Eye
} from 'lucide-react';
import { theme } from '@/lib/theme';

interface RoleDashboardCardsProps {
  onCardClick?: (cardId: string) => void;
}

export function RoleDashboardCards({ onCardClick }: RoleDashboardCardsProps) {
  const { user } = useAuthStore();

  if (!user) return null;

  // Cards para Security
  const securityCards = [
    {
      id: 'gates',
      title: 'PORTÕES',
      value: '8',
      icon: <DoorOpen size={20} />,
      color: theme.colors.primary,
      trend: { value: 12, label: 'vs ontem', positive: true }
    },
    {
      id: 'people',
      title: 'PESSOAS',
      value: '12.4K',
      icon: <Users size={20} />,
      color: '#10B981',
      trend: { value: 8, label: 'vs ontem', positive: false }
    },
    {
      id: 'sos',
      title: 'SOS ATIVOS',
      value: '2',
      icon: <AlertCircle size={20} />,
      color: theme.colors.error,
      trend: { value: 0, label: 'estável', positive: true }
    },
    {
      id: 'zones',
      title: 'ZONAS CRÍT.',
      value: '1',
      icon: <MapPin size={20} />,
      color: '#F59E0B',
      trend: { value: 50, label: 'vs ontem', positive: false }
    }
  ];

  // Cards para Cleaning
  const cleaningCards = [
    {
      id: 'bins',
      title: 'LIXEIRAS CHEIAS',
      value: '3',
      icon: <Trash2 size={20} />,
      color: theme.colors.primary,
      trend: { value: 2, label: 'pendentes', positive: false }
    },
    {
      id: 'cleaned',
      title: 'ZONAS LIMPAS',
      value: '12/20',
      icon: <CheckCircle size={20} />,
      color: '#10B981',
      trend: { value: 60, label: 'concluído', positive: true }
    },
    {
      id: 'tasks',
      title: 'TASKS PEND.',
      value: '7',
      icon: <ClipboardList size={20} />,
      color: theme.colors.error,
      trend: { value: 3, label: 'urgentes', positive: false }
    },
    {
      id: 'area',
      title: 'ÁREA TOTAL',
      value: '5.2K m²',
      icon: <MapPin size={20} />,
      color: '#F59E0B',
      trend: { value: 0, label: 'coberto', positive: true }
    }
  ];

  // Cards para Supervisor
  const supervisorCards = [
    {
      id: 'staff',
      title: 'STAFF ATIVO',
      value: '24',
      icon: <Users size={20} />,
      color: theme.colors.primary,
      trend: { value: 4, label: 'online', positive: true }
    },
    {
      id: 'resolved',
      title: 'SOS RESOLV.',
      value: '98%',
      icon: <Shield size={20} />,
      color: '#10B981',
      trend: { value: 2, label: 'vs ontem', positive: true }
    },
    {
      id: 'response',
      title: 'TEMP. MÉDIO',
      value: '3:42',
      icon: <Timer size={20} />,
      color: theme.colors.error,
      trend: { value: 12, label: 'mais rápido', positive: true }
    },
    {
      id: 'monitored',
      title: 'ZONAS MONIT.',
      value: '15',
      icon: <Eye size={20} />,
      color: '#F59E0B',
      trend: { value: 3, label: 'novas', positive: true }
    }
  ];

  const getCards = () => {
    switch(user.role) {
      case 'Security':
        return securityCards;
      case 'Cleaning':
        return cleaningCards;
      case 'Supervisor':
        return supervisorCards;
      default:
        return [];
    }
  };

  const cards = getCards();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <DashboardCard
          key={card.id}
          title={card.title}
          value={card.value}
          icon={card.icon}
          color={card.color}
          trend={card.trend}
          onClick={() => onCardClick?.(card.id)}
        />
      ))}
    </div>
  );
}