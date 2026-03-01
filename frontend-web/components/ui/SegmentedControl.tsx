'use client';

import { useState } from 'react';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function SegmentedControl({ 
  options, 
  defaultValue, 
  onChange, 
  size = 'md',
  fullWidth = false
}: SegmentedControlProps) {
  const [selected, setSelected] = useState(defaultValue || options[0]?.value);

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const handleSelect = (value: string) => {
    setSelected(value);
    onChange?.(value);
  };

  return (
    <div className={`
      inline-flex p-1 bg-gray-100 rounded-lg
      ${fullWidth ? 'w-full' : ''}
    `}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => handleSelect(option.value)}
          className={`
            ${sizes[size]}
            ${fullWidth ? 'flex-1' : ''}
            ${selected === option.value
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
            }
            rounded-md font-medium transition-all duration-200
            flex items-center justify-center gap-2
          `}
        >
          {option.icon && <span>{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}