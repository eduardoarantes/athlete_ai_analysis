'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import {
  profileStepFourSchema,
  type ProfileStepFourData,
} from '@/lib/validations/profile'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StepFourProps {
  initialData?: ProfileStepFourData | null
  onSubmit: (data: ProfileStepFourData) => void
}

// Common timezones for quick selection
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Sao_Paulo', label: 'Brasília Time (BRT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
] as const

export function StepFour({ initialData, onSubmit }: StepFourProps) {
  const t = useTranslations('onboarding.step4')

  // Auto-detect timezone from browser
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Auto-detect language from browser
  const browserLanguage = navigator.language.split('-')[0] // Gets 'en' from 'en-US'
  const supportedLanguages = ['en', 'pt', 'es', 'fr']
  const detectedLanguage = supportedLanguages.includes(browserLanguage) ? browserLanguage : 'en'

  const form = useForm<ProfileStepFourData>({
    resolver: zodResolver(profileStepFourSchema),
    mode: 'all', // Validate on blur, change, and submit
    defaultValues: initialData || {
      preferredLanguage: detectedLanguage as any, // Auto-detected from browser
      timezone: detectedTimezone || 'America/New_York', // Auto-detected from browser
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id="step-four-form" className="space-y-6">
        {/* Language Selector */}
        <FormField
          control={form.control}
          name="preferredLanguage"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('language')}</FormLabel>
              <FormDescription>{t('languageDescription')}</FormDescription>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Timezone Selector */}
        <FormField
          control={form.control}
          name="timezone"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('timezone')}</FormLabel>
              <FormDescription>
                {t('timezoneDescription')}
                {detectedTimezone && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    {t('autoDetected')}: {detectedTimezone}
                  </span>
                )}
              </FormDescription>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
