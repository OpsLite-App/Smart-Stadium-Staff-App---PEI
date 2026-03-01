'use client';

import { ReactNode, useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  content?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'buttons';
  fullWidth?: boolean;
}

export function Tabs({ 
  tabs, 
  defaultTab, 
  onChange, 
  variant = 'underline',
  fullWidth = false
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const variants = {
    underline: {
      container: 'border-b border-gray-200',
      tab: (isActive: boolean, isDisabled: boolean) => `
        inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
        ${isActive 
          ? 'border-b-2 border-blue-600 text-blue-600' 
          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `
    },
    pills: {
      container: 'space-x-2',
      tab: (isActive: boolean, isDisabled: boolean) => `
        inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
        ${isActive 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `
    },
    buttons: {
      container: 'space-x-2',
      tab: (isActive: boolean, isDisabled: boolean) => `
        inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border
        ${isActive 
          ? 'bg-blue-50 border-blue-300 text-blue-700' 
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `
    }
  };

  const currentVariant = variants[variant];

  return (
    <div className={`${currentVariant.container} ${fullWidth ? 'flex' : ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && handleTabClick(tab.id)}
          disabled={tab.disabled}
          className={`
            ${currentVariant.tab(activeTab === tab.id, !!tab.disabled)}
            ${fullWidth ? 'flex-1 justify-center' : ''}
          `}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}