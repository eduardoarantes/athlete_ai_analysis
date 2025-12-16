'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles } from 'lucide-react'

interface ProfileStepProps {
  data: {
    profile?: {
      ftp: number
      weight: number
      maxHR: number
      weeklyHours: string
      experienceLevel: string
      daysPerWeek: number
    }
  }
  onUpdate: (data: any) => void
}

export function ProfileStep({ data, onUpdate }: ProfileStepProps) {
  const t = useTranslations('createPlan.profileStep')
  const t2 = useTranslations('createPlan.preferencesStep')
  const profile = data.profile || {
    ftp: 0,
    weight: 0,
    maxHR: 0,
    weeklyHours: '',
    experienceLevel: 'intermediate',
    daysPerWeek: 4,
  }

  const [suggestedFTP] = useState(275) // This would come from API
  const showFTPSuggestion = profile.ftp > 0 && Math.abs(profile.ftp - suggestedFTP) > 10

  const handleFieldChange = (field: string, value: string | number) => {
    onUpdate({
      profile: {
        ...profile,
        [field]: value,
      },
    })
  }

  const wkg = profile.ftp && profile.weight ? (profile.ftp / profile.weight).toFixed(2) : '0.00'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* FTP */}
      <div className="space-y-2">
        <Label htmlFor="ftp">{t('ftp')}</Label>
        <div className="flex gap-2">
          <Input
            id="ftp"
            type="number"
            value={profile.ftp || ''}
            onChange={(e) => handleFieldChange('ftp', parseInt(e.target.value))}
            placeholder="265"
            className="flex-1"
          />
          <span className="flex items-center text-sm text-muted-foreground">{t('watts')}</span>
        </div>
        {showFTPSuggestion && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              {t('ftpSuggestion', { ftp: suggestedFTP })}{' '}
              <button
                onClick={() => handleFieldChange('ftp', suggestedFTP)}
                className="underline font-semibold"
              >
                {t('applySuggestion')}
              </button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Weight */}
      <div className="space-y-2">
        <Label htmlFor="weight">{t('weight')}</Label>
        <div className="flex gap-2">
          <Input
            id="weight"
            type="number"
            value={profile.weight || ''}
            onChange={(e) => handleFieldChange('weight', parseFloat(e.target.value))}
            placeholder="70"
            className="flex-1"
          />
          <span className="flex items-center text-sm text-muted-foreground">{t('kg')}</span>
        </div>
      </div>

      {/* Power to Weight Ratio */}
      {profile.ftp > 0 && profile.weight > 0 && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{t('powerToWeight')}</span>
            <Badge variant="outline" className="text-lg">
              {wkg} W/kg
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {parseFloat(wkg) > 4.0
              ? t('wkgExcellent')
              : parseFloat(wkg) > 3.0
                ? t('wkgGood')
                : t('wkgImprove')}
          </p>
        </div>
      )}

      {/* Max Heart Rate */}
      <div className="space-y-2">
        <Label htmlFor="maxHR">{t('maxHr')}</Label>
        <div className="flex gap-2">
          <Input
            id="maxHR"
            type="number"
            value={profile.maxHR || ''}
            onChange={(e) => handleFieldChange('maxHR', parseInt(e.target.value))}
            placeholder="186"
            className="flex-1"
          />
          <span className="flex items-center text-sm text-muted-foreground">{t('bpm')}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('maxHrHint')}
        </p>
      </div>

      {/* Weekly Training Time */}
      <div className="space-y-2">
        <Label htmlFor="weeklyHours">{t('weeklyHours')}</Label>
        <Select value={profile.weeklyHours} onValueChange={(v) => handleFieldChange('weeklyHours', v)}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectWeeklyHours')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3-5">{t('hours3to5')}</SelectItem>
            <SelectItem value="5-8">{t('hours5to8')}</SelectItem>
            <SelectItem value="8-12">{t('hours8to12')}</SelectItem>
            <SelectItem value="12+">{t('hours12plus')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Experience Level */}
      <div className="space-y-2">
        <Label htmlFor="experience">{t('experience')}</Label>
        <Select
          value={profile.experienceLevel}
          onValueChange={(v) => handleFieldChange('experienceLevel', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('selectExperience')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">{t('beginner')}</SelectItem>
            <SelectItem value="intermediate">{t('intermediate')}</SelectItem>
            <SelectItem value="advanced">{t('advanced')}</SelectItem>
            <SelectItem value="expert">{t('expert')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Days per week */}
      <div className="space-y-2">
        <Label htmlFor="daysPerWeek">{t2('daysPerWeek')}</Label>
        <div className="space-y-4">
          <Input
            id="daysPerWeek"
            type="range"
            min="3"
            max="7"
            step="1"
            value={profile.daysPerWeek}
            onChange={(e) => handleFieldChange('daysPerWeek', parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t2('daysMin')}</span>
            <span className="font-semibold text-primary">{t2('daysValue', { days: profile.daysPerWeek })}</span>
            <span className="text-muted-foreground">{t2('daysMax')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
