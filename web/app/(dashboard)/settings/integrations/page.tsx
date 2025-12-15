'use client'

import { Toaster } from 'react-hot-toast'
import { IntegrationsSettings } from '@/components/settings/integrations-settings'

export default function IntegrationsPage() {
  return (
    <>
      <Toaster position="top-center" />
      <div className="space-y-6">
        <IntegrationsSettings />
      </div>
    </>
  )
}
