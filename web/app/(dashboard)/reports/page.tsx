'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

export default function ReportsPage() {
  const t = useTranslations('reports')
  const router = useRouter()

  useEffect(() => {
    const redirectToLatestReport = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('reports')
          .select('id')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          router.replace(`/reports/${data.id}`)
        }
      } catch {
        // No reports found, stay on this page
      }
    }

    redirectToLatestReport()
  }, [router])

  return (
    <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
          <div className="mt-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('noReportsTitle')}</h2>
            <p className="text-muted-foreground mb-4">{t('noReportsDescription')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
