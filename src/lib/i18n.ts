import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

// English is scheduled but not written yet (see the platform roadmap's
// localization phase) - the type/constant exists now so consumers can
// build against the real eventual set instead of a stringly-typed 'ru'.
export type Language = 'ru' | 'en'
export const LANGUAGES: Language[] = ['ru', 'en']
const STORAGE_KEY = 'schloss-language'

export function getStoredLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY) as Language | null
  if (stored && LANGUAGES.includes(stored)) return stored
  return 'ru'
}

export function setStoredLanguage(language: Language) {
  localStorage.setItem(STORAGE_KEY, language)
}

export interface CreateI18nOptions {
  /**
   * This app's own translated strings, one flat key -> string dict per
   * language. A language's dict doesn't need every key yet - i18next
   * falls back to `fallbackLng`'s value, and ultimately to the raw key
   * itself, for whatever's missing. Every app is Russian-only today, so
   * `en: {}` (or omitted entirely) is the expected starting point -
   * every lookup then falls through to `ru`, reproducing today's plain
   * hardcoded Russian strings exactly. Consumers add real `en` entries
   * incrementally later without this factory itself changing.
   */
  resources: Partial<Record<Language, Record<string, string>>>
}

// One i18next instance per consuming app - not a shared singleton, since
// each app owns its own translation resources - built through this one
// shared factory so every app gets identical language-detection and
// -persistence behavior instead of each hand-rolling i18next setup
// independently. Mirrors how theme.ts centralizes theme persistence
// rather than leaving that to every consumer.
export function createI18n({ resources }: CreateI18nOptions): I18nInstance {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    resources: Object.fromEntries(
      LANGUAGES.map((lng) => [lng, { translation: resources[lng] ?? {} }]),
    ),
    lng: getStoredLanguage(),
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
  })
  return instance
}

// The one function that actually changes the active language - updates
// the running instance and persists the choice, so a later reload (or a
// second app on the same origin, once more than one uses this) picks it
// back up via getStoredLanguage() above.
export async function setLanguage(instance: I18nInstance, language: Language): Promise<void> {
  setStoredLanguage(language)
  await instance.changeLanguage(language)
}
