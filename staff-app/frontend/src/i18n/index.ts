import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import pt from './locales/pt.json';
import en from './locales/en.json';

const RESOURCES = {
  PT: { translation: pt },
  EN: { translation: en },
};

const initI18n = async () => {
  const savedLanguage = await AsyncStorage.getItem('user-language');

  i18n
    .use(initReactI18next)
    .init({
      resources: RESOURCES,
      lng: savedLanguage || 'PT', 
      fallbackLng: 'PT',
      interpolation: {
        escapeValue: false, 
      },
    });
};

initI18n();

export default i18n;