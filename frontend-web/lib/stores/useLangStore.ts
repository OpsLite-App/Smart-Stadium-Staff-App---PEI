import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/lib/i18n';

interface LangStore {
  lang: 'pt' | 'en';
  setLang: (lang: 'pt' | 'en') => void;
  toggle: () => void;
}

export const useLangStore = create<LangStore>()(
  persist(
    (set, get) => ({
      lang: 'pt',
      setLang: (lang) => { i18n.changeLanguage(lang); set({ lang }); },
      toggle: () => {
        const next = get().lang === 'pt' ? 'en' : 'pt';
        i18n.changeLanguage(next);
        set({ lang: next });
      },
    }),
    { name: 'lang-storage' }
  )
);
