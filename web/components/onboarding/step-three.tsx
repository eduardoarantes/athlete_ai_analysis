'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  profileStepThreeSchema,
  type ProfileStepThreeData,
  PRESET_GOALS,
} from '@/lib/validations/profile'
import { Form, FormField, FormItem, FormLabel, FormDescription } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface StepThreeProps {
  initialData?: ProfileStepThreeData | null
  onSubmit: (data: ProfileStepThreeData) => void
}

export function StepThree({ initialData, onSubmit }: StepThreeProps) {
  const t = useTranslations('onboarding.step3')
  const [customGoal, setCustomGoal] = useState('')

  const form = useForm<ProfileStepThreeData>({
    resolver: zodResolver(profileStepThreeSchema),
    mode: 'all', // Validate on blur, change, and submit
    defaultValues: initialData || {
      goals: [],
    },
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

  const handleAddCustomGoal = () => {
    if (customGoal.trim()) {
      const current = form.getValues('goals')
      if (!current.includes(customGoal.trim())) {
        form.setValue('goals', [...current, customGoal.trim()], { shouldValidate: true })
      }
      setCustomGoal('')
    }
  }

  const handleRemoveGoal = (goal: string) => {
    const current = form.getValues('goals')
    form.setValue(
      'goals',
      current.filter((g) => g !== goal),
      { shouldValidate: true }
    )
  }

  const isPresetGoal = (goal: string): boolean => {
    return PRESET_GOALS.includes(goal as any)
  }

  const getGoalLabel = (goal: string): string => {
    const goalKey = goal as keyof typeof goalTranslationMap
    return goalTranslationMap[goalKey] || goal
  }

  const goalTranslationMap = {
    improve_ftp: t('improveFtp'),
    complete_century: t('completeCentury'),
    train_for_race: t('trainForRace'),
    build_endurance: t('buildEndurance'),
    weight_loss: t('weightLoss'),
    maintain_fitness: t('maintainFitness'),
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id="step-three-form" className="space-y-6">
        <FormField
          control={form.control}
          name="goals"
          render={({ fieldState }) => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">{t('selectGoals')}</FormLabel>
                <FormDescription>{t('subtitle')}</FormDescription>
              </div>

              {/* Preset Goals */}
              <div className="space-y-3">
                {PRESET_GOALS.map((goal) => (
                  <div key={goal} className="flex items-center space-x-3">
                    <Checkbox
                      checked={currentGoals.includes(goal)}
                      onCheckedChange={() => handlePresetGoalToggle(goal)}
                      id={goal}
                    />
                    <label
                      htmlFor={goal}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {getGoalLabel(goal)}
                    </label>
                  </div>
                ))}
              </div>

              {/* Custom Goals Display */}
              {currentGoals.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {currentGoals
                      .filter((goal) => !isPresetGoal(goal))
                      .map((goal) => (
                        <div
                          key={goal}
                          className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm flex items-center gap-2"
                        >
                          <span>{goal}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGoal(goal)}
                            className="hover:text-destructive"
                            aria-label={`Remove ${goal}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Custom Goal Input */}
              <div className="mt-4 space-y-2">
                <FormLabel htmlFor="custom-goal">{t('customGoal')}</FormLabel>
                <div className="flex gap-2">
                  <Input
                    id="custom-goal"
                    placeholder={t('customGoalPlaceholder')}
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustomGoal()
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddCustomGoal} variant="outline">
                    {t('addCustomGoal')}
                  </Button>
                </div>
              </div>

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
