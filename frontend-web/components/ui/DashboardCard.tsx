'use client';

import { theme } from '@/lib/theme';
import { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
  onClick?: () => void;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: string;
}

export function DashboardCard({ 
  title, 
  value, 
  icon, 
  onClick,
  trend,
  color = theme.colors.primary
}: DashboardCardProps) {

  return (
    <div 
      onClick={onClick}
      className={`
        bg-white rounded-lg shadow-sm p-5 
        ${onClick ? 'cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]' : ''}
        relative overflow-hidden
      `}
    >
      {/* Linha decorativa à esquerda */}
      <div 
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
        style={{ backgroundColor: color }}
      />

      <div className="pl-3">
        {/* Header com ícone e título */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            {title}
          </span>
          {icon && (
            <div className="text-gray-400">
              {icon}
            </div>
          )}
        </div>

        {/* Valor principal */}
        <div className="text-3xl font-bold text-gray-900 mb-2">
          {value}
        </div>

        {/* Trend (opcional) */}
        {trend && (
          <div className="flex items-center gap-2 text-sm">
            <span 
              className={`
                font-semibold
                ${trend.positive ? 'text-green-600' : 'text-red-600'}
              `}
            >
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-gray-500">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}