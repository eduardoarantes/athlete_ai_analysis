'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { errorLogger } from '@/lib/monitoring/error-logger'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ScheduleError({ error, reset }: ErrorProps) {
  const t = useTranslations('schedule')

  useEffect(() => {
    // Log the error for monitoring
    errorLogger.logError(error, {
      path: '/schedule',
      metadata: { digest: error.digest },
    })
  }, [error])

  return (
    <div className="container mx-auto py-6">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>{t('error.title')}</CardTitle>
          </div>
          <CardDescription>{t('error.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-muted rounded text-sm font-mono overflow-auto">
              {error.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('error.retry')}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                {t('error.goHome')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
