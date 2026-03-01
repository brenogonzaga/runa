import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../../i18n/en.json";
import pt from "../../i18n/pt.json";

export const resources = {
  en: { translation: en },
  pt: { translation: pt },
} as const;

export const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    debug: false,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "runa-language",
    },
  });

export default i18n;
