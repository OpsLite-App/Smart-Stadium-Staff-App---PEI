'use client';

import { useAuthStore } from '@/lib/stores/useAuthStore';
import { ChevronLeft, Shield, Brush, UserCog, User } from 'lucide-react';
import { theme } from '@/lib/theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  showProfile?: boolean;
  onProfilePress?: () => void;
  roleSpecific?: boolean; // Se true, usa cores e ícones baseados no role
}

export function AppHeader({ 
  title,
  subtitle,
  showBack = false,
  onBackPress,
  showProfile = true,
  onProfilePress,
  roleSpecific = false
}: AppHeaderProps) {
  
  const { user } = useAuthStore();

  // Se roleSpecific for true, busca dados do user
  const getRoleConfig = () => {
    if (!roleSpecific || !user) {
      return {
        icon: Shield,
        iconColor: theme.colors.primary,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        defaultTitle: 'Painel',
        defaultSubtitle: 'Sistema operacional • Em tempo real'
      };
    }

    switch(user.role) {
      case 'Security':
        return {
          icon: Shield,
          iconColor: '#3B82F6',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          defaultTitle: 'Painel de segurança',
          defaultSubtitle: 'Sistema de Segurança • Ao Vivo'
        };
      case 'Cleaning':
        return {
          icon: Brush,
          iconColor: '#10B981',
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          defaultTitle: 'Cleaning Operations',
          defaultSubtitle: 'Operações de Limpeza • Ativo'
        };
      case 'Supervisor':
        return {
          icon: UserCog,  
          iconColor: '#F59E0B',
          bgColor: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          defaultTitle: 'Painel de supervisão',
          defaultSubtitle: 'Gestão de operações • Em tempo real'
        };
      default:
        return {
          icon: Shield,
          iconColor: theme.colors.primary,
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          defaultTitle: 'Painel',
          defaultSubtitle: 'Sistema operacional • Em tempo real'
        };
    }
  };

  const config = getRoleConfig();
  const IconComponent = config.icon;

  // Usar título fornecido ou o default do role
  const displayTitle = title || config.defaultTitle;
  const displaySubtitle = subtitle || config.defaultSubtitle;

  return (
    <header className="bg-white border-b border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {/* Back button */}
          {showBack && (
            <button
              onClick={onBackPress}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Voltar"
            >
              <ChevronLeft size={24} className="text-gray-700" />
            </button>
          )}
          
          {/* Role icon (se roleSpecific) */}
          {roleSpecific && (
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <IconComponent size={20} color={config.iconColor} />
            </div>
          )}
          
          {/* Title and subtitle */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{displayTitle}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className={`text-xs font-semibold ${config.textColor}`}>
                {displaySubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Profile button */}
        {showProfile && (
          <button
            onClick={onProfilePress}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Perfil"
          >
            <User size={28} className="text-gray-600" />
          </button>
        )}
      </div>
    </header>
  );
}
