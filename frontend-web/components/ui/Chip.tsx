'use client';

import { X } from 'lucide-react';
import { ReactNode } from 'react';

export type ChipVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type ChipSize = 'sm' | 'md' | 'lg';

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: ReactNode;
  onDelete?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Chip({ 
  children, 
  variant = 'default',
  size = 'md',
  icon,
  onDelete,
  onClick,
  disabled = false,
  className = ''
}: ChipProps) {

  const variants = {
    default: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200',
      hover: 'hover:bg-gray-200'
    },
    primary: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      hover: 'hover:bg-blue-200'
    },
    success: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      hover: 'hover:bg-green-200'
    },
    warning: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      hover: 'hover:bg-yellow-200'
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
      hover: 'hover:bg-red-200'
    },
    info: {
      bg: 'bg-cyan-100',
      text: 'text-cyan-800',
      border: 'border-cyan-200',
      hover: 'hover:bg-cyan-200'
    }
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2'
  };

  const variantStyles = variants[variant];
  const isClickable = onClick || onDelete;

  return (
    <span
      onClick={!disabled ? onClick : undefined}
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantStyles.bg} ${variantStyles.text}
        border ${variantStyles.border}
        ${sizes[size]}
        ${isClickable && !disabled ? variantStyles.hover + ' cursor-pointer' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      
      <span>{children}</span>
      
      {onDelete && !disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5"
        >
          <X size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
        </button>
      )}
    </span>
  );
}