'use client';

import { Shield, Brush, UserCog, HeartPulse } from 'lucide-react';

interface StaffMarkerProps {
  role: 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';
  name: string;
  status?: 'online' | 'busy' | 'offline';
  onClick?: () => void;
}

export function StaffMarker({ role, name, status = 'online', onClick }: StaffMarkerProps) {
  
  // Configurações por role
  const getConfig = () => {
    switch (role) {
      case 'Security':
        return {
          icon: Shield,
          bgColor: 'bg-blue-500',
          borderColor: 'border-blue-600',
          label: 'Segurança'
        };
      case 'Cleaning':
        return {
          icon: Brush,
          bgColor: 'bg-green-500',
          borderColor: 'border-green-600',
          label: 'Limpeza'
        };
      case 'Supervisor':
        return {
          icon: UserCog,
          bgColor: 'bg-yellow-500',
          borderColor: 'border-yellow-600',
          label: 'Supervisor'
        };
      case 'Medical':
        return {
          icon: HeartPulse,
          bgColor: 'bg-red-500',
          borderColor: 'border-red-600',
          label: 'Médico'
        };
      default:
        return {
          icon: Shield,
          bgColor: 'bg-gray-500',
          borderColor: 'border-gray-600',
          label: 'Staff'
        };
    }
  };

  // Cor do status
  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'busy': return 'bg-yellow-400';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-green-400';
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  return (
    <div 
      onClick={onClick}
      className="relative cursor-pointer group"
    >
      {/* Marcador principal */}
      <div 
        className={`
          w-10 h-10 rounded-full ${config.bgColor} 
          border-2 ${config.borderColor} 
          flex items-center justify-center
          shadow-lg group-hover:scale-110 transition-transform
        `}
      >
        <IconComponent size={20} className="text-white" />
      </div>

      {/* Indicador de status */}
      <div 
        className={`
          absolute -bottom-1 -right-1 w-4 h-4 rounded-full 
          ${getStatusColor()} border-2 border-white
        `}
      />

      {/* Tooltip com nome (aparece no hover) */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
        <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
          <div className="font-bold">{name}</div>
          <div className="text-gray-300">{config.label}</div>
        </div>
        {/* Seta do tooltip */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}