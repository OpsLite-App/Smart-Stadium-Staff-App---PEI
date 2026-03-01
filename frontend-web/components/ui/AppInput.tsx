'use client';

import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';

interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  leftIcon?: 'email' | 'lock' | 'user' | string;
}

export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(({ 
  label, 
  error, 
  leftIcon,
  className = '',
  id,
  ...props 
}, ref) => {
  // Usar useId do React em vez de Math.random
  const generatedId = useId();
  const inputId = id || generatedId;

  const renderLeftIcon = () => {
    if (!leftIcon) return null;
    
    const iconProps = { size: 18, className: 'text-gray-400' };
    
    switch(leftIcon) {
      case 'email':
        return <Mail {...iconProps} />;
      case 'lock':
        return <Lock {...iconProps} />;
      case 'user':
        return <User {...iconProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="mb-4">
      <label 
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {renderLeftIcon()}
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2 border rounded-lg transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${leftIcon ? 'pl-10' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      
      {error && (
        <div className="flex items-center gap-1 mt-1 text-red-500 text-sm">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});

AppInput.displayName = 'AppInput';