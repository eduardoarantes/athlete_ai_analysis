'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Target, Trophy, Heart, TrendingUp, Bike } from 'lucide-react'

interface GoalStepProps {
  data: {
    goal?: string
    customGoal?: string
  }
  onUpdate: (data: any) => void
}

const GOAL_IDS = ['improve-ftp', 'build-endurance', 'race-prep', 'weight-loss', 'general-fitness'] as const

const GOAL_ICONS = {
  'improve-ftp': { icon: TrendingUp, color: 'text-blue-500' },
  'build-endurance': { icon: Bike, color: 'text-green-500' },
  'race-prep': { icon: Trophy, color: 'text-yellow-500' },
  'weight-loss': { icon: Heart, color: 'text-red-500' },
  'general-fitness': { icon: Target, color: 'text-purple-500' },
}

export function GoalStep({ data, onUpdate }: GoalStepProps) {
  const t = useTranslations('createPlan.goalStep')
  const [selectedGoal, setSelectedGoal] = useState(data.goal || '')
  const [customGoal, setCustomGoal] = useState(data.customGoal || '')

  // Sync state when data prop changes (for session restoration)
  useEffect(() => {
    if (data.goal) setSelectedGoal(data.goal)
    if (data.customGoal !== undefined) setCustomGoal(data.customGoal)
  }, [data.goal, data.customGoal])

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId)
    onUpdate({ goal: goalId, customGoal: '' })
  }

  const handleCustomGoalChange = (value: string) => {
    setCustomGoal(value)
    onUpdate({ goal: 'custom', customGoal: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      <RadioGroup value={selectedGoal} onValueChange={handleGoalSelect}>
        <div className="grid gap-4">
          {GOAL_IDS.map((goalId) => {
            const { icon: Icon, color } = GOAL_ICONS[goalId]
            const isSelected = selectedGoal === goalId

            return (
              <Label
                key={goalId}
                htmlFor={goalId}
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value={goalId} id={goalId} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <span className="font-semibold">{t(`goals.${goalId}.label`)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t(`goals.${goalId}.description`)}</p>
                </div>
              </Label>
            )
          })}
        </div>
      </RadioGroup>

      <div className="space-y-2">
        <Label htmlFor="custom-goal">{t('customGoalLabel')}</Label>
        <Textarea
          id="custom-goal"
          placeholder={t('customGoalPlaceholder')}
          value={customGoal}
          onChange={(e) => handleCustomGoalChange(e.target.value)}
          rows={3}
          className={customGoal ? 'border-primary' : ''}
        />
        {customGoal && (
          <p className="text-xs text-muted-foreground">
            {t('customGoalHint')}
          </p>
        )}
      </div>
    </div>
  )
}
