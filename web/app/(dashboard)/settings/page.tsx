'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Toaster, toast } from 'react-hot-toast'
import { ProfileForm } from '@/components/profile/profile-form'
import type { CompleteProfileData } from '@/lib/validations/profile'
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const t = useTranslations('settings')
  const [profileData, setProfileData] = useState<CompleteProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load profile data on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to load profile')
        }

        // Transform snake_case to camelCase
        const profile = result.profile
        const transformedProfile: CompleteProfileData = {
          firstName: profile.first_name,
          lastName: profile.last_name,
          age: profile.age,
          gender: profile.gender,
          ftp: profile.ftp,
          maxHr: profile.max_hr,
          weightKg: profile.weight_kg,
          goals: profile.goals,
          preferredLanguage: profile.preferred_language,
          timezone: profile.timezone,
          unitsSystem: profile.units_system,
        }

        setProfileData(transformedProfile)
      } catch (err) {
        console.error('Error loading profile:', err)
        setError(err instanceof Error ? err.message : 'Failed to load profile')
        toast.error('Failed to load profile')
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  // Handle profile updates
  const handleSave = async (data: CompleteProfileData) => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile')
      }

      // Update local state with saved data
      setProfileData(data)
    } catch (err) {
      console.error('Error saving profile:', err)
      throw err // Re-throw to let auto-save hook handle the error
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">{error || 'Profile not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" />
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        <ProfileForm initialData={profileData} onSave={handleSave} />
      </div>
    </>
  )
}
