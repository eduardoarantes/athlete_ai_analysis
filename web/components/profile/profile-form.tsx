'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import {
  completeProfileSchema,
  type CompleteProfileData,
  PRESET_GOALS,
} from '@/lib/validations/profile'
import { useAutoSave, type SaveStatus } from '@/lib/hooks/use-auto-save'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader2, Check, AlertCircle } from 'lucide-react'

interface ProfileFormProps {
  initialData: CompleteProfileData
  onSave: (data: CompleteProfileData) => Promise<void>
}

const SaveStatusIndicator = ({
  status,
  lastSaved,
}: {
  status: SaveStatus
  lastSaved: Date | null
}) => {
  const t = useTranslations('profile')

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('saving')}</span>
      </div>
    )
  }

  if (status === 'saved') {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>{t('saved')}</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span>{t('errorSaving')}</span>
      </div>
    )
  }

  if (lastSaved) {
    return (
      <div className="text-sm text-muted-foreground">
        Last saved: {lastSaved.toLocaleTimeString()}
      </div>
    )
  }

  return null
}

export function ProfileForm({ initialData, onSave }: ProfileFormProps) {
  const t = useTranslations('profile')
  const tStep1 = useTranslations('onboarding.step1')
  const tStep2 = useTranslations('onboarding.step2')
  const tStep3 = useTranslations('onboarding.step3')
  const tStep4 = useTranslations('onboarding.step4')

  const form = useForm<CompleteProfileData>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: initialData,
  })

  const formData = form.watch()

  const { saveStatus, lastSaved } = useAutoSave({
    data: formData,
    onSave: async (data) => {
      // Only save if form is valid
      const isValid = await form.trigger()
      if (isValid) {
        await onSave(data)
      }
    },
    debounceMs: 1000,
    enabled: true,
  })

  const currentGoals = form.watch('goals')

  const handlePresetGoalToggle = (goal: string) => {
    const current = form.getValues('goals')
    if (current.includes(goal)) {
      form.setValue(
        'goals',
        current.filter((g) => g !== goal),
        { shouldValidate: true }
      )
    } else {
      form.setValue('goals', [...current, goal], { shouldValidate: true })
    }
  }

  const getGoalLabel = (goal: string): string => {
    const goalTranslationMap: Record<string, string> = {
      improve_ftp: tStep3('improveFtp'),
      complete_century: tStep3('completeCentury'),
      train_for_race: tStep3('trainForRace'),
      build_endurance: tStep3('buildEndurance'),
      weight_loss: tStep3('weightLoss'),
      maintain_fitness: tStep3('maintainFitness'),
    }
    return goalTranslationMap[goal] || goal
  }

  return (
    <div className="space-y-6">
      {/* Save Status Indicator */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{t('autoSave')}</p>
        <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} />
      </div>

      <Form {...form}>
        <form className="space-y-8">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('personalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep1('firstName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep1('lastName')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep1('age')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep1('gender')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">{tStep1('male')}</SelectItem>
                          <SelectItem value="female">{tStep1('female')}</SelectItem>
                          <SelectItem value="other">{tStep1('other')}</SelectItem>
                          <SelectItem value="prefer_not_to_say">
                            {tStep1('preferNotToSay')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>{t('performanceMetrics')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ftp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep2('ftp')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={tStep2('ftpPlaceholder')}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? null : parseInt(value, 10))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weightKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep2('weight')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder={tStep2('weightPlaceholder')}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? null : parseFloat(value))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxHr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep2('maxHr')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={tStep2('maxHrPlaceholder')}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? null : parseInt(value, 10))
                          }}
                        />
                      </FormControl>
                      <FormDescription>{tStep2('maxHrDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="restingHr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep2('restingHr')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={tStep2('restingHrPlaceholder')}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === '' ? null : parseInt(value, 10))
                          }}
                        />
                      </FormControl>
                      <FormDescription>{tStep2('restingHrDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Goals */}
          <Card>
            <CardHeader>
              <CardTitle>{t('goals')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="goals"
                render={() => (
                  <FormItem>
                    <div className="space-y-3">
                      {PRESET_GOALS.map((goal) => (
                        <div key={goal} className="flex items-center space-x-3">
                          <Checkbox
                            checked={currentGoals.includes(goal)}
                            onCheckedChange={() => handlePresetGoalToggle(goal)}
                            id={`profile-${goal}`}
                          />
                          <label
                            htmlFor={`profile-${goal}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {getGoalLabel(goal)}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>{t('preferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="preferredLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep4('language')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="pt">Português</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tStep4('timezone')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="unitsSystem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tStep4('unitsSystem')}</FormLabel>
                    <FormDescription>{tStep4('unitsDescription')}</FormDescription>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="metric">{tStep4('metric')}</SelectItem>
                          <SelectItem value="imperial">{tStep4('imperial')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}
