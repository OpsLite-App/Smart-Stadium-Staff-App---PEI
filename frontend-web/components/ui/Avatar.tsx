'use client';

import { User, Shield, Brush, UserCog, HeartPulse } from 'lucide-react';
import { ReactNode } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarVariant = 'circular' | 'rounded' | 'square';

interface AvatarProps {
  src?: string;
  name?: string;
  role?: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';
  size?: AvatarSize;
  variant?: AvatarVariant;
  status?: 'online' | 'busy' | 'offline';
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Avatar({ 
  src, 
  name,
  role,
  size = 'md',
  variant = 'circular',
  status,
  icon,
  onClick,
  className = ''
}: AvatarProps) {

  // Tamanhos
  const sizes = {
    xs: {
      container: 'w-6 h-6',
      text: 'text-xs',
      icon: 12,
      status: 'w-1.5 h-1.5'
    },
    sm: {
      container: 'w-8 h-8',
      text: 'text-sm',
      icon: 16,
      status: 'w-2 h-2'
    },
    md: {
      container: 'w-10 h-10',
      text: 'text-base',
      icon: 20,
      status: 'w-2.5 h-2.5'
    },
    lg: {
      container: 'w-12 h-12',
      text: 'text-lg',
      icon: 24,
      status: 'w-3 h-3'
    },
    xl: {
      container: 'w-16 h-16',
      text: 'text-xl',
      icon: 32,
      status: 'w-3.5 h-3.5'
    }
  };

  // Variantes de borda
  const variants = {
    circular: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none'
  };

  // Cores por role
  const getRoleColor = () => {
    switch (role) {
      case 'Security': return 'bg-blue-500';
      case 'Cleaning': return 'bg-green-500';
      case 'Supervisor': return 'bg-yellow-500';
      case 'Medical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Ícone por role
  const getRoleIcon = () => {
    switch (role) {
      case 'Security': return <Shield size={sizes[size].icon} className="text-white" />;
      case 'Cleaning': return <Brush size={sizes[size].icon} className="text-white" />;
      case 'Supervisor': return <UserCog size={sizes[size].icon} className="text-white" />;
      case 'Medical': return <HeartPulse size={sizes[size].icon} className="text-white" />;
      default: return <User size={sizes[size].icon} className="text-white" />;
    }
  };

  // Cor do status
  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return null;
    }
  };

  // Obter iniciais do nome
  const getInitials = () => {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeConfig = sizes[size];
  const statusColor = getStatusColor();

  return (
    <div 
      onClick={onClick}
      className={`
        relative inline-block
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        ${className}
      `}
    >
      {/* Avatar content */}
      <div 
        className={`
          ${sizeConfig.container}
          ${variants[variant]}
          ${src ? '' : getRoleColor()}
          flex items-center justify-center
          overflow-hidden
          border-2 border-white shadow-md
        `}
      >
        {src ? (
          <img 
            src={src} 
            alt={name || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : icon ? (
          <div className="text-white">{icon}</div>
        ) : (
          <>
            {name ? (
              <span className={`${sizeConfig.text} font-bold text-white`}>
                {getInitials()}
              </span>
            ) : (
              getRoleIcon()
            )}
          </>
        )}
      </div>

      {/* Status indicator */}
      {status && statusColor && (
        <div 
          className={`
            absolute bottom-0 right-0
            ${sizeConfig.status}
            ${statusColor}
            rounded-full
            border-2 border-white
          `}
        />
      )}
    </div>
  );
}

// Componentes específicos
export function UserAvatar({ 
  user, 
  size = 'md',
  showStatus = true,
  onClick 
}: { 
  user: {
    name: string;
    role: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';
    status?: 'online' | 'busy' | 'offline';
    avatar?: string;
  };
  size?: AvatarSize;
  showStatus?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar
        src={user.avatar}
        name={user.name}
        role={user.role}
        size={size}
        status={showStatus ? user.status : undefined}
        onClick={onClick}
      />
      <div>
        <div className="font-medium text-gray-900">{user.name}</div>
        <div className="text-xs text-gray-500">{user.role}</div>
      </div>
    </div>
  );
}

export function AvatarGroup({ 
  users,
  max = 4,
  size = 'md',
  onMoreClick 
}: { 
  users: Array<{ name: string; role: string; avatar?: string }>;
  max?: number;
  size?: AvatarSize;
onMoreClick?: (event: React.MouseEvent<HTMLDivElement>) => void;}) {
  const visibleUsers = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex -space-x-2">
      {visibleUsers.map((user, index) => (
        <Avatar
          key={index}
          name={user.name}
          role={user.role as 'Security' | 'Cleaning' | 'Supervisor' | 'Medical'}
          size={size}
          className="border-2 border-white"
        />
      ))}
      
      {remaining > 0 && (
        <div 
          onClick={onMoreClick}
          className={`
            ${size === 'xs' ? 'w-6 h-6 text-xs' : ''}
            ${size === 'sm' ? 'w-8 h-8 text-sm' : ''}
            ${size === 'md' ? 'w-10 h-10 text-base' : ''}
            ${size === 'lg' ? 'w-12 h-12 text-lg' : ''}
            ${size === 'xl' ? 'w-16 h-16 text-xl' : ''}
            rounded-full bg-gray-200 border-2 border-white
            flex items-center justify-center font-medium text-gray-600
            cursor-pointer hover:bg-gray-300 transition-colors
          `}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}