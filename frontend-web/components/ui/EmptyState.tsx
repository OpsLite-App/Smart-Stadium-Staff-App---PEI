'use client';

import { ReactNode } from 'react';
import { Inbox, AlertCircle, Search, CheckCircle } from 'lucide-react';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  type?: 'default' | 'error' | 'success' | 'search';
}

export function EmptyState({ 
  title, 
  description, 
  icon, 
  action,
  type = 'default'
}: EmptyStateProps) {

  // Ícones por tipo
  const getIcon = () => {
    if (icon) return icon;

    switch (type) {
      case 'error':
        return <AlertCircle size={48} className="text-red-400" />;
      case 'success':
        return <CheckCircle size={48} className="text-green-400" />;
      case 'search':
        return <Search size={48} className="text-gray-400" />;
      default:
        return <Inbox size={48} className="text-gray-400" />;
    }
  };

  // Cores por tipo
  const getColors = () => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          description: 'text-red-600'
        };
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          description: 'text-green-600'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-900',
          description: 'text-gray-600'
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`
      ${colors.bg} ${colors.border}
      border rounded-lg p-8 text-center
    `}>
      <div className="flex flex-col items-center gap-4">
        {/* Ícone */}
        <div className="mb-2">
          {getIcon()}
        </div>

        {/* Título */}
        <h3 className={`text-lg font-semibold ${colors.text}`}>
          {title}
        </h3>

        {/* Descrição */}
        {description && (
          <p className={`text-sm ${colors.description} max-w-sm`}>
            {description}
          </p>
        )}

        {/* Ação */}
        {action && (
          <div className="mt-4">
            <AppButton
              title={action.label}
              onClick={action.onClick}
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Exemplos pré-configurados
export function NoAlertsEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      type="default"
      title="Sem alertas ativos"
      description="Não há alertas para mostrar no momento."
      action={onRefresh ? {
        label: "Atualizar",
        onClick: onRefresh
      } : undefined}
    />
  );
}

export function NoResultsEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      type="search"
      title="Nenhum resultado encontrado"
      description="Tenta usar outros termos de pesquisa."
      action={onClear ? {
        label: "Limpar pesquisa",
        onClick: onClear
      } : undefined}
    />
  );
}

export function ErrorEmptyState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      type="error"
      title="Ocorreu um erro"
      description={message}
      action={onRetry ? {
        label: "Tentar novamente",
        onClick: onRetry
      } : undefined}
    />
  );
}