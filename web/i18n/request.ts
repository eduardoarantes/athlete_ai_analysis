import { getRequestConfig } from 'next-intl/server'
import { getUserLocale } from '@/lib/locale'

export default getRequestConfig(async () => {
  // Get locale from user profile or cookie
  const locale = await getUserLocale()

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
  }
})
