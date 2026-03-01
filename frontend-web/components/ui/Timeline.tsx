'use client';

import { ReactNode } from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  status?: 'pending' | 'completed' | 'error' | 'warning';
  icon?: ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  variant?: 'default' | 'compact';
}

export function Timeline({ items, variant = 'default' }: TimelineProps) {
  
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={16} className="text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-orange-500';
      default: return 'bg-gray-300';
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flow-root">
        <ul className="-mb-8">
          {items.map((item, index) => (
            <li key={item.id}>
              <div className="relative pb-8">
                {index < items.length - 1 && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`
                      h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white
                      ${getStatusColor(item.status)}
                    `}>
                      {item.icon || getStatusIcon(item.status)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-900">{item.title}</p>
                      {item.description && (
                        <p className="mt-0.5 text-sm text-gray-500">{item.description}</p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      {item.time}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Variante default
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`
              w-3 h-3 rounded-full mt-1.5
              ${getStatusColor(item.status)}
            `} />
            <div className="w-0.5 h-full bg-gray-200" />
          </div>
          
          <div className="flex-1 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                {item.time}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}