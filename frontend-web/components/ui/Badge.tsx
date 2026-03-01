'use client';

import { ReactNode } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle,
  AlertTriangle
} from 'lucide-react';

export type BadgeVariant = 
  | 'default' 
  | 'primary' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info'
  | 'purple'
  | 'pink';

export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  rounded?: boolean;
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'default',
  size = 'md',
  icon,
  rounded = false,
  className = ''
}: BadgeProps) {

  // Cores por variante
  const variants = {
    default: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200'
    },
    primary: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200'
    },
    success: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200'
    },
    warning: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200'
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200'
    },
    info: {
      bg: 'bg-cyan-100',
      text: 'text-cyan-800',
      border: 'border-cyan-200'
    },
    purple: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200'
    },
    pink: {
      bg: 'bg-pink-100',
      text: 'text-pink-800',
      border: 'border-pink-200'
    }
  };

  // Tamanhos
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const variantStyles = variants[variant];
  const roundedClass = rounded ? 'rounded-full' : 'rounded';

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 font-medium
        ${variantStyles.bg} ${variantStyles.text} 
        border ${variantStyles.border}
        ${sizes[size]} ${roundedClass}
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// Badges pré-configurados para casos comuns
export function PriorityBadge({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const config = {
    HIGH: { variant: 'error' as const, icon: <AlertCircle size={14} />, label: 'ALTA' },
    MEDIUM: { variant: 'warning' as const, icon: <Clock size={14} />, label: 'MÉDIA' },
    LOW: { variant: 'success' as const, icon: <CheckCircle size={14} />, label: 'BAIXA' }
  };

  const { variant, icon, label } = config[priority];

  return (
    <Badge variant={variant} size="sm" icon={icon}>
      {label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: 'online' | 'busy' | 'offline' }) {
  const config = {
    online: { variant: 'success' as const, label: 'Online' },
    busy: { variant: 'warning' as const, label: 'Ocupado' },
    offline: { variant: 'default' as const, label: 'Offline' }
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} size="sm" rounded>
      {label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    Security: { variant: 'primary', label: 'Segurança' },
    Cleaning: { variant: 'success', label: 'Limpeza' },
    Supervisor: { variant: 'warning', label: 'Supervisor' },
    Medical: { variant: 'error', label: 'Médico' }
  };

  const { variant, label } = config[role] || { variant: 'default', label: role };

  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}