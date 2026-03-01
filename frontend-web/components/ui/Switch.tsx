'use client';

import { useState } from 'react';

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  description?: string;
}

export function Switch({ 
  checked = false, 
  onChange, 
  disabled = false,
  size = 'md',
  label,
  description
}: SwitchProps) {
  const [isChecked, setIsChecked] = useState(checked);

  const sizes = {
    sm: {
      switch: 'w-8 h-4',
      dot: 'w-3 h-3',
      translate: 'translate-x-4'
    },
    md: {
      switch: 'w-11 h-6',
      dot: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      switch: 'w-14 h-7',
      dot: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    const newValue = !isChecked;
    setIsChecked(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="flex items-center justify-between">
      {(label || description) && (
        <div className="flex-1">
          {label && <p className="text-sm font-medium text-gray-900">{label}</p>}
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
      )}
      
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleToggle}
        className={`
          relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isChecked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${sizes[size].switch}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out
            ${isChecked ? sizes[size].translate : 'translate-x-0'}
            ${sizes[size].dot}
          `}
        />
      </button>
    </div>
  );
}