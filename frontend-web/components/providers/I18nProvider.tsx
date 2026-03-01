'use client';

import { useEffect } from 'react';
import i18n from '@/lib/i18n/config';
import { I18nextProvider } from 'react-i18next';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Carregar língua guardada
    const savedLanguage = localStorage.getItem('user-language');
    if (savedLanguage && (savedLanguage === 'pt' || savedLanguage === 'en')) {
      i18n.changeLanguage(savedLanguage);
    }

    // Guardar quando mudar
    const handleLanguageChanged = (lng: string) => {
      localStorage.setItem('user-language', lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []); 

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}