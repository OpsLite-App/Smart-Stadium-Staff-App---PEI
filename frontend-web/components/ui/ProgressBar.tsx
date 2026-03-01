'use client';

import { ReactNode } from 'react';

export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface ProgressBarProps {
  value: number; // 0 a 100
  max?: number; // valor máximo (default 100)
  size?: ProgressBarSize;
  variant?: ProgressBarVariant;
  showLabel?: boolean;
  labelPosition?: 'top' | 'right' | 'bottom' | 'inside';
  labelFormat?: (value: number, max: number) => string;
  icon?: ReactNode;
  animate?: boolean;
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ 
  value, 
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  labelPosition = 'top',
  labelFormat = (val, max) => `${Math.round((val / max) * 100)}%`,
  icon,
  animate = true,
  className = '',
  barClassName = ''
}: ProgressBarProps) {

  // Calcular percentagem
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Cores por variante
  const variants = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    info: 'bg-cyan-500'
  };

  // Alturas por tamanho
  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  // Label
  const label = labelFormat(value, max);

  // Renderizar label conforme posição
  const renderLabel = (position: 'top' | 'right' | 'bottom' | 'inside') => {
    if (!showLabel) return null;

    const labelElement = (
      <span className="text-xs font-medium text-gray-700">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </span>
    );

    if (position === 'top') {
      return <div className="mb-1">{labelElement}</div>;
    }

    if (position === 'bottom') {
      return <div className="mt-1">{labelElement}</div>;
    }

    if (position === 'right') {
      return <div className="ml-3">{labelElement}</div>;
    }

    return null; // inside é tratado separadamente
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Label top */}
      {labelPosition === 'top' && renderLabel('top')}

      <div className="flex items-center">
        {/* Container da barra */}
        <div className="flex-1">
          <div 
            className={`
              w-full bg-gray-200 rounded-full overflow-hidden
              ${sizes[size]}
            `}
          >
            {/* Barra de progresso */}
            <div 
              className={`
                ${variants[variant]} 
                ${sizes[size]} 
                rounded-full
                ${animate ? 'transition-all duration-500 ease-out' : ''}
                ${barClassName}
              `}
              style={{ width: `${percentage}%` }}
            >
              {/* Label inside (apenas se houver espaço) */}
              {labelPosition === 'inside' && percentage > 20 && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                  {label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Label right */}
        {labelPosition === 'right' && renderLabel('right')}
      </div>

      {/* Label bottom */}
      {labelPosition === 'bottom' && renderLabel('bottom')}
    </div>
  );
}

// Componentes específicos para casos de uso
export function GateProgressBar({ 
  gateId, 
  occupancy, 
  onClick 
}: { 
  gateId: string; 
  occupancy: number; 
  onClick?: () => void;
}) {
  const getVariant = (value: number): ProgressBarVariant => {
    if (value >= 90) return 'error';
    if (value >= 70) return 'warning';
    if (value >= 40) return 'info';
    return 'success';
  };

  return (
    <div 
      onClick={onClick}
      className={`
        bg-white rounded-lg p-3 shadow-sm 
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-sm">{gateId}</span>
        <span className="text-xs font-medium text-gray-600">
          {occupancy}% ocupado
        </span>
      </div>
      <ProgressBar 
        value={occupancy}
        variant={getVariant(occupancy)}
        size="sm"
        animate
      />
    </div>
  );
}

export function KPIProgressBar({ 
  label, 
  value, 
  target, 
  unit = '%',
  onClick 
}: { 
  label: string; 
  value: number; 
  target: number; 
  unit?: string;
  onClick?: () => void;
}) {
  const percentage = (value / target) * 100;
  const isAboveTarget = value >= target;

  return (
    <div 
      onClick={onClick}
      className={`
        bg-white rounded-lg p-4 shadow-sm
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold">
          {value}{unit} / {target}{unit}
        </span>
      </div>
      
      <ProgressBar 
        value={percentage}
        variant={isAboveTarget ? 'success' : 'warning'}
        size="md"
        animate
      />
      
      <div className="mt-2 text-xs text-gray-500">
        {isAboveTarget ? '✓ Meta atingida' : `${Math.round(target - value)}${unit} para a meta`}
      </div>
    </div>
  );
}

export function MultiProgressBar({ 
  segments 
}: { 
  segments: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
}) {
  const total = segments.reduce((acc, seg) => acc + seg.value, 0);

  return (
    <div className="w-full">
      <div className="flex h-4 rounded-full overflow-hidden">
        {segments.map((segment, index) => {
          const width = (segment.value / total) * 100;
          return (
            <div
              key={index}
              className={segment.color}
              style={{ width: `${width}%` }}
              title={segment.label}
            />
          );
        })}
      </div>
      
      {/* Legendas */}
      {segments.some(s => s.label) && (
        <div className="flex gap-4 mt-2 text-xs">
          {segments.map((segment, index) => (
            segment.label && (
              <div key={index} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${segment.color}`} />
                <span>{segment.label}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}