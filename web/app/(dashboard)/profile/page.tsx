'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Toaster, toast } from 'react-hot-toast'
import { ProfileForm } from '@/components/profile/profile-form'
import type { CompleteProfileData } from '@/lib/validations/profile'
import { Loader2, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ProfileCompleteness {
  percentage: number
  missingFields: string[]
  isComplete: boolean
}

function calculateProfileCompleteness(profile: CompleteProfileData): ProfileCompleteness {
  const fields = [
    { name: 'firstName', value: profile.firstName, label: 'First Name' },
    { name: 'lastName', value: profile.lastName, label: 'Last Name' },
    { name: 'age', value: profile.age, label: 'Age' },
    { name: 'gender', value: profile.gender, label: 'Gender' },
    { name: 'ftp', value: profile.ftp, label: 'FTP' },
    { name: 'maxHr', value: profile.maxHr, label: 'Max Heart Rate' },
    { name: 'weightKg', value: profile.weightKg, label: 'Weight' },
    { name: 'goals', value: profile.goals?.length > 0, label: 'Goals' },
    { name: 'preferredLanguage', value: profile.preferredLanguage, label: 'Language' },
    { name: 'timezone', value: profile.timezone, label: 'Timezone' },
    { name: 'unitsSystem', value: profile.unitsSystem, label: 'Units System' },
  ]

  const missingFields = fields
    .filter((f) => !f.value)
    .map((f) => f.label)

  const completedCount = fields.length - missingFields.length
  const percentage = Math.round((completedCount / fields.length) * 100)

  return {
    percentage,
    missingFields,
    isComplete: missingFields.length === 0,
  }
}

function ProfileCompletenessCard({ completeness }: { completeness: ProfileCompleteness }) {
  const t = useTranslations('profile')

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {completeness.isComplete ? (
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <User className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">
                {completeness.isComplete ? t('profileComplete') : t('profileIncomplete')}
              </h3>
              <span className="text-sm font-medium text-muted-foreground">
                {completeness.percentage}%
              </span>
            </div>
            <Progress value={completeness.percentage} className="h-2" />
            {!completeness.isComplete && completeness.missingFields.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('missingFields')}: {completeness.missingFields.slice(0, 3).join(', ')}
                {completeness.missingFields.length > 3 && ` +${completeness.missingFields.length - 3} more`}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const t = useTranslations('profile')
  const router = useRouter()
  const [profileData, setProfileData] = useState<CompleteProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  // Calculate profile completeness
  const completeness = useMemo(() => {
    if (!profileData) return null
    return calculateProfileCompleteness(profileData)
  }, [profileData])

  // Load profile data on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile')
        const result = await response.json()

        if (!response.ok) {
          // If profile not found (404), user needs to complete onboarding
          if (response.status === 404) {
            setNeedsOnboarding(true)
            return
          }
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
          goals: profile.goals || [],
          preferredLanguage: profile.preferred_language,
          timezone: profile.timezone,
          unitsSystem: profile.units_system,
        }

        setProfileData(transformedProfile)
      } catch (err) {
        console.error('Error loading profile:', err)
        setError(err instanceof Error ? err.message : 'Failed to load profile')
        toast.error(t('errorLoading'))
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [t, router])

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

  // User needs to complete onboarding first
  if (needsOnboarding) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <User className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">{t('setupRequired')}</h1>
          <p className="text-muted-foreground mb-6">{t('setupRequiredDescription')}</p>
          <Button asChild size="lg">
            <Link href="/onboarding">{t('startSetup')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (error || !profileData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <div className="mb-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-destructive mb-2">{t('errorTitle')}</h1>
          <p className="text-muted-foreground">{error || t('profileNotFound')}</p>
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

        {completeness && <ProfileCompletenessCard completeness={completeness} />}

        <ProfileForm initialData={profileData} onSave={handleSave} />
      </div>
    </>
  )
}
