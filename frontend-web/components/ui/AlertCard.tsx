'use client';

import { theme } from '@/lib/theme';
import { 
  AlertOctagon, 
  Users, 
  Trash2, 
  Wrench, 
  MapPin, 
  Clock,
  CheckCircle
} from 'lucide-react';

export type AlertType = 'sos' | 'crowd' | 'bin' | 'maintenance';

interface AlertCardProps {
  type: AlertType;
  title: string;
  location: string;
  time: string;
  description?: string;
  onPress: () => void;
  onAccept?: () => void;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function AlertCard({ 
  type, 
  title, 
  location, 
  time, 
  description, 
  onPress,
  onAccept,
  priority = 'MEDIUM'
}: AlertCardProps) {

  // Configurações por tipo de alerta
  const getConfig = () => {
    switch (type) {
      case 'sos':
        return { 
          color: theme.colors.error, 
          bg: '#FEF2F2', 
          icon: AlertOctagon, 
          label: priority || 'CRÍTICO',
          iconBg: 'bg-red-100'
        };
      case 'crowd':
        return { 
          color: '#F59E0B', 
          bg: '#FFFBEB', 
          icon: Users, 
          label: priority || 'DENSIDADE',
          iconBg: 'bg-amber-100'
        };
      case 'bin':
        return { 
          color: theme.colors.primary, 
          bg: '#EEF2FF', 
          icon: Trash2, 
          label: priority || 'MANUTENÇÃO',
          iconBg: 'bg-blue-100'
        };
      case 'maintenance':
        return { 
          color: theme.colors.primary, 
          bg: '#EEF2FF', 
          icon: Wrench, 
          label: priority || 'MANUTENÇÃO',
          iconBg: 'bg-blue-100'
        };
      default:
        return { 
          color: theme.colors.textSecondary, 
          bg: '#F3F4F6', 
          icon: AlertOctagon, 
          label: 'INFO',
          iconBg: 'bg-gray-100'
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  // Cores para prioridade
  const priorityColor = {
    'HIGH': theme.colors.error,
    'MEDIUM': '#F59E0B',
    'LOW': '#10B981'
  }[priority];

  return (
    <div 
      className="bg-white rounded-lg shadow-sm mb-3 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onPress}
    >
      <div className="p-4">
        {/* Header: Badge e Tempo */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            {/* Ícone com fundo colorido */}
            <div className={`p-1.5 rounded-lg ${config.iconBg}`}>
              <IconComponent size={16} color={config.color} />
            </div>
            
            {/* Badge de prioridade */}
            <span 
              className="text-xs font-bold px-2 py-1 rounded"
              style={{ 
                backgroundColor: config.bg,
                color: config.color 
              }}
            >
              {config.label}
            </span>

            {/* Prioridade (se diferente do label) */}
            {priority !== 'MEDIUM' && type !== 'sos' && (
              <span 
                className="text-xs font-bold px-2 py-1 rounded bg-gray-100"
                style={{ color: priorityColor }}
              >
                {priority}
              </span>
            )}
          </div>
          
          {/* Tempo */}
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={12} />
            <span className="text-xs">{time}</span>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
          
          {/* Localização */}
          <div className="flex items-center gap-1 text-gray-600 mb-2">
            <MapPin size={14} />
            <span className="text-sm font-medium">{location}</span>
          </div>
          
          {/* Descrição (se existir) */}
          {description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* Botão de Ação (se existir) */}
        {onAccept && (
          <div className="pt-3 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation(); // Evitar que o clique no botão também ative o onPress do card
                onAccept();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white font-bold text-sm transition-colors"
              style={{ backgroundColor: config.color }}
            >
              <CheckCircle size={16} />
              <span>ACEITAR TAREFA</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}