import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../../i18n/en.json";
import pt from "../../i18n/pt.json";
import es from "../../i18n/es.json";
import fr from "../../i18n/fr.json";
import de from "../../i18n/de.json";
import ja from "../../i18n/ja.json";
import zhCN from "../../i18n/zh-CN.json";

export const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  ja: { translation: ja },
  "zh-CN": { translation: zhCN },
} as const;

export const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文" },
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
