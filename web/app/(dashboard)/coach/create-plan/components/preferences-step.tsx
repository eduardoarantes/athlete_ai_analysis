'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

interface PreferencesStepProps {
  data: {
    preferences?: {
      daysPerWeek: number
      workoutTypes: string[]
      indoorOnly: boolean
    }
  }
  onUpdate: (data: any) => void
}

const WORKOUT_TYPE_IDS = ['intervals', 'endurance', 'recovery', 'tempo', 'sweet-spot', 'vo2max'] as const

export function PreferencesStep({ data, onUpdate }: PreferencesStepProps) {
  const t = useTranslations('createPlan.preferencesStep')
  const preferences = data.preferences || {
    daysPerWeek: 4,
    workoutTypes: ['intervals', 'endurance', 'recovery'],
    indoorOnly: false,
  }

  const handleDaysChange = (value: number) => {
    onUpdate({
      preferences: {
        ...preferences,
        daysPerWeek: value,
      },
    })
  }

  const handleWorkoutTypeToggle = (typeId: string, checked: boolean) => {
    const newTypes = checked
      ? [...preferences.workoutTypes, typeId]
      : preferences.workoutTypes.filter((t) => t !== typeId)

    onUpdate({
      preferences: {
        ...preferences,
        workoutTypes: newTypes,
      },
    })
  }

  const handleIndoorToggle = (checked: boolean) => {
    onUpdate({
      preferences: {
        ...preferences,
        indoorOnly: checked,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Days per week */}
      <div className="space-y-2">
        <Label htmlFor="daysPerWeek">{t('daysPerWeek')}</Label>
        <div className="space-y-4">
          <Input
            id="daysPerWeek"
            type="range"
            min="3"
            max="7"
            step="1"
            value={preferences.daysPerWeek}
            onChange={(e) => handleDaysChange(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('daysMin')}</span>
            <span className="font-semibold text-primary">{t('daysValue', { days: preferences.daysPerWeek })}</span>
            <span className="text-muted-foreground">{t('daysMax')}</span>
          </div>
        </div>
      </div>

      {/* Workout types */}
      <div className="space-y-4">
        <Label>{t('workoutTypes')}</Label>
        <div className="space-y-3">
          {WORKOUT_TYPE_IDS.map((typeId) => (
            <div key={typeId} className="flex items-start space-x-3 p-3 rounded-lg border">
              <Checkbox
                id={typeId}
                checked={preferences.workoutTypes.includes(typeId)}
                onCheckedChange={(checked) => handleWorkoutTypeToggle(typeId, checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor={typeId} className="font-medium cursor-pointer">
                  {t(`workoutTypeOptions.${typeId}.label`)}
                </Label>
                <p className="text-sm text-muted-foreground">{t(`workoutTypeOptions.${typeId}.description`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indoor/Outdoor preference */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="indoorOnly">{t('indoorOnly')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('indoorOnlyDescription')}
          </p>
        </div>
        <Switch
          id="indoorOnly"
          checked={preferences.indoorOnly}
          onCheckedChange={handleIndoorToggle}
        />
      </div>
    </div>
  )
}
