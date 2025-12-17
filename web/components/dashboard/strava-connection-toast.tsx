'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, XCircle, X } from 'lucide-react'

export function StravaConnectionToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations('strava')
  const [dismissed, setDismissed] = useState(false)

  const stravaConnected = searchParams.get('strava_connected') === 'true'
  const stravaError = searchParams.get('strava_error')
  const isSuccess = stravaConnected
  const shouldShow = (stravaConnected || stravaError) && !dismissed

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'access_denied':
        return t('errorAccessDenied')
      case 'invalid_request':
      case 'invalid_state':
      case 'db_error':
      case 'callback_failed':
      default:
        return t('errorDefault')
    }
  }

  // Clean URL after showing toast
  useEffect(() => {
    if (stravaConnected || stravaError) {
      const timer = setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.delete('strava_connected')
        url.searchParams.delete('strava_error')
        router.replace(url.pathname, { scroll: false })
      }, 100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [stravaConnected, stravaError, router])

  // Auto-dismiss after 5 seconds for success
  useEffect(() => {
    if (shouldShow && isSuccess) {
      const timer = setTimeout(() => {
        setDismissed(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [shouldShow, isSuccess])

  if (!shouldShow) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div
        className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-md ${
          isSuccess
            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <h4
            className={`font-semibold ${
              isSuccess ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            }`}
          >
            {isSuccess ? t('connectionSuccess') : t('connectionError')}
          </h4>
          <p
            className={`text-sm mt-1 ${
              isSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}
          >
            {isSuccess ? t('connectionSuccessDescription') : getErrorMessage(stravaError || '')}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
            isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
