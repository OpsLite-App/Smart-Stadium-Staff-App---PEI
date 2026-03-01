'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'text-blue-500',
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`animate-spin ${sizes[size]} ${color}`} />
      {text && <p className="text-sm text-gray-600">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Variantes para casos específicos
export function PageLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" text="A carregar..." />
    </div>
  );
}

export function ButtonLoader() {
  return <LoadingSpinner size="sm" color="text-white" />;
}

export function SectionLoader() {
  return (
    <div className="py-8 flex items-center justify-center">
      <LoadingSpinner text="A carregar..." />
    </div>
  );
}