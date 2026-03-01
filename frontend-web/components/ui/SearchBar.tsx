'use client';

import { Search, X } from 'lucide-react';
import { InputHTMLAttributes, forwardRef } from 'react';

interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  onSearch?: (value: string) => void;
  delay?: number;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(({ 
  value,
  onChange,
  onClear,
  onSearch,
  placeholder = 'Pesquisar...',
  delay = 300,
  className = '',
  ...props 
}, ref) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      // Simular evento de change com valor vazio
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange?.(event);
    }
  };

  return (
    <div className="relative w-full">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        <Search size={18} />
      </div>
      
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`
          w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          text-sm
          ${className}
        `}
        {...props}
      />
      
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';