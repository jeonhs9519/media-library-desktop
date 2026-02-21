import { useCallback, useEffect, useState } from 'react'
import { isLanguageSetting, LanguageSetting, Locale, resolveLocale, t } from './i18n'

export function useI18n() {
  const [languageSetting, setLanguageSetting] = useState<LanguageSetting>('system')
  const [locale, setLocale] = useState<Locale>(resolveLocale('system'))

  useEffect(() => {
    window.api.settings.get('ui.language').then((v: string | undefined) => {
      const nextSetting: LanguageSetting = isLanguageSetting(v) ? v : 'system'
      setLanguageSetting(nextSetting)
      setLocale(resolveLocale(nextSetting))
    })
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const tr = useCallback((key: string, vars?: Record<string, string | number>) => t(locale, key, vars), [locale])

  const changeLanguageSetting = useCallback(async (value: LanguageSetting) => {
    setLanguageSetting(value)
    setLocale(resolveLocale(value))
    await window.api.settings.set('ui.language', value)
  }, [])

  return {
    locale,
    languageSetting,
    tr,
    changeLanguageSetting,
  }
}
