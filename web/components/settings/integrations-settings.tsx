'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { StravaConnection } from '@/components/strava/strava-connection'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Watch, Cloud, Lock } from 'lucide-react'

interface Integration {
  id: string
  nameKey: string
  descriptionKey: string
  icon: React.ReactNode
  status: 'available' | 'connected' | 'coming-soon'
  category: 'training-platforms' | 'devices'
  component?: React.ComponentType
}

const integrations: Integration[] = [
  {
    id: 'strava',
    nameKey: 'strava',
    descriptionKey: 'stravaDescription',
    icon: <Activity className="h-6 w-6" />,
    status: 'available',
    category: 'training-platforms',
    component: StravaConnection,
  },
  {
    id: 'garmin',
    nameKey: 'garmin',
    descriptionKey: 'garminDescription',
    icon: <Watch className="h-6 w-6" />,
    status: 'coming-soon',
    category: 'training-platforms',
  },
  {
    id: 'wahoo',
    nameKey: 'wahoo',
    descriptionKey: 'wahooDescription',
    icon: <Cloud className="h-6 w-6" />,
    status: 'coming-soon',
    category: 'devices',
  },
  {
    id: 'trainingpeaks',
    nameKey: 'trainingpeaks',
    descriptionKey: 'trainingpeaksDescription',
    icon: <Activity className="h-6 w-6" />,
    status: 'coming-soon',
    category: 'training-platforms',
  },
]

export function IntegrationsSettings() {
  const t = useTranslations('settings.integrations')
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>('strava')

  const groupedIntegrations = integrations.reduce<Record<string, Integration[]>>(
    (acc, integration) => {
      const category = integration.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category]!.push(integration)
      return acc
    },
    {}
  )

  const categoryKeys = {
    'training-platforms': 'trainingPlatforms',
    devices: 'devices',
  } as const

  return (
    <div className="space-y-8">
      {/* Integration Categories */}
      {Object.entries(groupedIntegrations).map(([category, items]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xl font-semibold">
            {t(`categories.${categoryKeys[category as keyof typeof categoryKeys]}`)}
          </h2>
          <div className="grid gap-4">
            {items.map((integration) => (
              <Card key={integration.id} className="overflow-hidden">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 p-2 rounded-lg bg-primary/10 text-primary">
                        {integration.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{t(integration.nameKey)}</CardTitle>
                          {integration.status === 'connected' && (
                            <Badge variant="default" className="bg-green-500">
                              {t('status.connected')}
                            </Badge>
                          )}
                          {integration.status === 'coming-soon' && (
                            <Badge variant="secondary">{t('status.comingSoon')}</Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1.5">
                          {t(integration.descriptionKey)}
                        </CardDescription>
                      </div>
                    </div>
                    {integration.component && (
                      <button
                        onClick={() =>
                          setExpandedIntegration(
                            expandedIntegration === integration.id ? null : integration.id
                          )
                        }
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {expandedIntegration === integration.id ? t('hide') : t('configure')}
                      </button>
                    )}
                  </div>
                </CardHeader>

                {/* Expanded Integration Component */}
                {expandedIntegration === integration.id && integration.component && (
                  <CardContent className="border-t pt-6">
                    <integration.component />
                  </CardContent>
                )}

                {/* Coming Soon Message */}
                {integration.status === 'coming-soon' && (
                  <CardContent className="border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span>{t('comingSoonMessage')}</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Info Section */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">{t('needDifferent')}</CardTitle>
          <CardDescription>{t('needDifferentDescription')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
