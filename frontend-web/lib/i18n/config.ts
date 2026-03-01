import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import pt from '../locales/pt.json';
import en from '../locales/en.json';

const RESOURCES = {
  pt: { translation: pt },
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    resources: RESOURCES,
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false, 
    }
  });

export default i18n;