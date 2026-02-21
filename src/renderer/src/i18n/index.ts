import { enMessages } from './locales/en'
import { koMessages } from './locales/ko'
import { jaMessages } from './locales/ja'
import { zhMessages } from './locales/zh'

export type Locale = 'en' | 'ko' | 'ja' | 'zh'
export type LanguageSetting = 'system' | Locale

const languageSettings: LanguageSetting[] = ['system', 'en', 'ko', 'ja', 'zh']

const messages: Record<Locale, Record<string, string>> = {
  en: enMessages,
  ko: koMessages,
  ja: jaMessages,
  zh: zhMessages,
}

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return typeof value === 'string' && languageSettings.includes(value as LanguageSetting)
}

export function getSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const source = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'
  const lang = source.toLowerCase()
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('ja')) return 'ja'
  if (lang.startsWith('zh')) return 'zh'
  return 'en'
}

export function resolveLocale(languageSetting: LanguageSetting): Locale {
  if (languageSetting === 'system') return getSystemLocale()
  return languageSetting
}

export function t(locale: Locale, key: string, vars?: Record<string, string | number>) {
  const template = messages[locale][key] ?? messages.en[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_full, variableName) => {
    const value = vars[variableName]
    return value === undefined ? `{${variableName}}` : String(value)
  })
}
