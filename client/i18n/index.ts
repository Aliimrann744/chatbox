import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { cache } from '@/services/cache';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'es', label: 'Spanish', native: 'Español' },
  { value: 'fr', label: 'French', native: 'Français' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['value'] | 'system';

export const LANGUAGE_CACHE_KEY = 'settings:language';
const FALLBACK = 'en';

function detectDeviceLanguage(): string {
  try {
    const locales = Localization.getLocales?.() || [];
    const primary = locales[0]?.languageCode || 'en';
    const supported = SUPPORTED_LANGUAGES.map((l) => l.value);
    return supported.includes(primary as any) ? primary : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * Resolves a stored preference ('system' or a concrete code) to the language
 * i18next should actually use.
 */
export function resolveLanguage(pref: string | null | undefined): string {
  if (!pref || pref === 'system') return detectDeviceLanguage();
  const supported = SUPPORTED_LANGUAGES.map((l) => l.value);
  return supported.includes(pref as any) ? pref : FALLBACK;
}

// Read the cached preference synchronously so the first render uses the
// right language (no flash of English for Spanish/French users).
const storedPref = cache.get<string>(LANGUAGE_CACHE_KEY);
const initialLang = resolveLanguage(storedPref);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
  },
  lng: initialLang,
  fallbackLng: FALLBACK,
  interpolation: { escapeValue: false },
  returnNull: false,
  compatibilityJSON: 'v4',
});

export async function changeLanguage(pref: LanguageCode): Promise<void> {
  cache.set(LANGUAGE_CACHE_KEY, pref);
  const target = resolveLanguage(pref);
  await i18n.changeLanguage(target);
}

export default i18n;
