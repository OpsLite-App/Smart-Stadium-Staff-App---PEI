// components/ui/Surface.tsx
'use client';

import { ReactNode } from 'react';

interface SurfaceProps {
  children: ReactNode;
  className?: string;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
}

export function Surface({ 
  children, 
  className = '', 
  elevation = 'md' 
}: SurfaceProps) {
  const elevationStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg'
  };

  return (
    <div className={`bg-white rounded-lg ${elevationStyles[elevation]} ${className}`}>
      {children}
    </div>
  );
}