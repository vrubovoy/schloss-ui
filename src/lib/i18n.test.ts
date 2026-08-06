import { describe, it, expect, beforeEach } from 'vitest'
import { LANGUAGES, getStoredLanguage, setStoredLanguage, createI18n, setLanguage } from './i18n'

// Mirrors the "schloss-theme" convention in theme.ts - confirmed empirically
// (not by reading i18n.ts) by calling setStoredLanguage and inspecting which
// localStorage key it wrote to.
const STORAGE_KEY = 'schloss-language'

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// LANGUAGES constant
// ---------------------------------------------------------------------------
describe('LANGUAGES', () => {
  it('contains exactly "ru" and "en"', () => {
    expect(new Set(LANGUAGES)).toEqual(new Set(['ru', 'en']))
    expect(LANGUAGES).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// getStoredLanguage
// ---------------------------------------------------------------------------
describe('getStoredLanguage', () => {
  it('returns "ru" when nothing has ever been stored', () => {
    expect(getStoredLanguage()).toBe('ru')
  })

  it('returns the stored value when a valid language was previously set', () => {
    setStoredLanguage('en')
    expect(getStoredLanguage()).toBe('en')
  })

  it('falls back to "ru" when localStorage holds an invalid value ("fr")', () => {
    localStorage.setItem(STORAGE_KEY, 'fr')
    expect(getStoredLanguage()).toBe('ru')
  })

  it('falls back to "ru" when localStorage holds an invalid value ("xx")', () => {
    localStorage.setItem(STORAGE_KEY, 'xx')
    expect(getStoredLanguage()).toBe('ru')
  })

  it('falls back to "ru" when localStorage holds an empty string', () => {
    localStorage.setItem(STORAGE_KEY, '')
    expect(getStoredLanguage()).toBe('ru')
  })
})

// ---------------------------------------------------------------------------
// setStoredLanguage / getStoredLanguage round-trip
// ---------------------------------------------------------------------------
describe('setStoredLanguage', () => {
  it('persists a language choice that a later getStoredLanguage call returns', () => {
    setStoredLanguage('en')
    expect(getStoredLanguage()).toBe('en')
  })

  it('round-trips "ru" as well', () => {
    setStoredLanguage('en')
    setStoredLanguage('ru')
    expect(getStoredLanguage()).toBe('ru')
  })
})

// ---------------------------------------------------------------------------
// createI18n
// ---------------------------------------------------------------------------
describe('createI18n', () => {
  it('returns an instance with a working t() translation function', async () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    await i18n.changeLanguage('ru')
    expect(i18n.t('greeting')).toBe('Привет')
  })

  it('translates using the switched-to language', async () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    await i18n.changeLanguage('en')
    expect(i18n.t('greeting')).toBe('Hello')
  })

  it('falls back to the Russian string when English has no translations for a key', async () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: {} },
    })
    await i18n.changeLanguage('en')
    expect(i18n.t('greeting')).toBe('Привет')
  })

  it('returns the raw key when the key is missing from every language', async () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: {} },
    })
    await i18n.changeLanguage('en')
    expect(i18n.t('neverDefinedKey')).toBe('neverDefinedKey')
  })

  it('initializes already set to the currently stored language', () => {
    setStoredLanguage('en')
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    expect(i18n.language).toBe('en')
    expect(i18n.t('greeting')).toBe('Hello')
  })

  it('initializes to "ru" when nothing was stored', () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    expect(i18n.language).toBe('ru')
  })

  it('creates independent instances that do not share hidden global state', async () => {
    const i18nA = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    const i18nB = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })

    await i18nA.changeLanguage('en')

    expect(i18nA.language).toBe('en')
    expect(i18nB.language).toBe('ru')
    expect(i18nB.t('greeting')).toBe('Привет')
  })
})

// ---------------------------------------------------------------------------
// setLanguage
// ---------------------------------------------------------------------------
describe('setLanguage', () => {
  it('changes the active language of the given instance', async () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    await setLanguage(i18n, 'en')
    expect(i18n.language).toBe('en')
    expect(i18n.t('greeting')).toBe('Hello')
  })

  it('persists the change so a fresh getStoredLanguage call returns it', async () => {
    const i18n = createI18n({
      resources: { ru: { greeting: 'Привет' }, en: { greeting: 'Hello' } },
    })
    await setLanguage(i18n, 'en')
    expect(getStoredLanguage()).toBe('en')
  })
})
