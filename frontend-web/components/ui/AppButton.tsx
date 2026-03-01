'use client';

import { ButtonHTMLAttributes } from 'react';
import { theme } from '@/lib/theme';
import { LogIn, Send, ArrowLeft, Loader2 } from 'lucide-react';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  mode?: 'contained' | 'outlined' | 'text';
  loading?: boolean;
  icon?: 'login' | 'send' | 'arrow-back' | string;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';  // ← ADICIONAR ESTA LINHA
}

export function AppButton({ 
  title, 
  mode = 'contained', 
  loading = false, 
  disabled = false,
  icon,
  fullWidth = false,
  size = 'md',  // ← ADICIONAR ESTA LINHA (valor default)
  className = '',
  ...props 
}: AppButtonProps) {
  
  // Estilos base
  const baseStyles = 'font-bold rounded transition-all duration-200 flex items-center justify-center gap-2';
  
  // Tamanhos
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  // Estilos por modo
  const modeStyles = {
    contained: `bg-[${theme.colors.primary}] text-white hover:bg-[${theme.colors.primaryDark}]`,
    outlined: `border-2 border-[${theme.colors.primary}] text-[${theme.colors.primary}] hover:bg-[${theme.colors.primary}] hover:text-white`,
    text: `text-[${theme.colors.primary}] hover:bg-gray-100`
  };

  // Largura
  const widthStyles = fullWidth ? 'w-full' : '';

  // Estado disabled/loading
  const stateStyles = (disabled || loading) ? 'opacity-50 cursor-not-allowed' : '';

  // Renderizar ícone correto
  const renderIcon = () => {
    if (!icon) return null;
    
    switch(icon) {
      case 'login':
        return <LogIn size={size === 'sm' ? 14 : size === 'md' ? 16 : 20} />;
      case 'send':
        return <Send size={size === 'sm' ? 14 : size === 'md' ? 16 : 20} />;
      case 'arrow-back':
        return <ArrowLeft size={size === 'sm' ? 14 : size === 'md' ? 16 : 20} />;
      default:
        return null;
    }
  };

  return (
    <button
      className={[
        baseStyles,
        sizes[size],
        modeStyles[mode],
        widthStyles,
        stateStyles,
        className
      ].join(' ')}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={size === 'sm' ? 14 : size === 'md' ? 16 : 20} />}
      
      {!loading && renderIcon()}
      
      <span>{title}</span>
    </button>
  );
}