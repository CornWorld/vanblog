import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhTranslation from './locales/zh.json';

i18n
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next
  .use(initReactI18next)
  // init i18next
  .init({
    debug: process.env.NODE_ENV === 'development',
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      zh: {
        translation: zhTranslation,
      },
    },
  });

export default i18n;
