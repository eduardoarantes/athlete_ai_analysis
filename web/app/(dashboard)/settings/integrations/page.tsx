import { StravaConnection } from '@/components/strava/strava-connection'

export default function IntegrationsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your training platforms to sync activities and analyze performance
          </p>
        </div>

        <StravaConnection />
      </div>
    </div>
  )
}
