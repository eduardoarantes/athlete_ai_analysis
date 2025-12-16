'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { profileStepTwoSchema, type ProfileStepTwoData } from '@/lib/validations/profile'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StepTwoProps {
  initialData?: ProfileStepTwoData | null
  onSubmit: (data: ProfileStepTwoData) => void
}

export function StepTwo({ initialData, onSubmit }: StepTwoProps) {
  const t = useTranslations('onboarding.step2')
  const [unitsSystem, setUnitsSystem] = useState<'metric' | 'imperial'>(
    initialData?.unitsSystem || 'metric'
  )

  const form = useForm<ProfileStepTwoData>({
    resolver: zodResolver(profileStepTwoSchema),
    mode: 'all', // Validate on blur, change, and submit
    defaultValues: initialData || {
      ftp: null,
      maxHr: null,
      restingHr: null,
      weightKg: null,
      unitsSystem: 'metric',
    },
  })

  const convertWeight = (value: number, toMetric: boolean): number => {
    if (toMetric) {
      // lbs to kg
      return Math.round(value / 2.205 * 10) / 10
    } else {
      // kg to lbs
      return Math.round(value * 2.205 * 10) / 10
    }
  }

  const handleUnitsToggle = () => {
    const newUnits = unitsSystem === 'metric' ? 'imperial' : 'metric'
    setUnitsSystem(newUnits)

    // Convert weight if present
    const currentWeight = form.getValues('weightKg')
    if (currentWeight) {
      const converted = convertWeight(currentWeight, newUnits === 'metric')
      form.setValue('weightKg', converted)
    }

    form.setValue('unitsSystem', newUnits)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} id="step-two-form" className="space-y-6">
        {/* FTP */}
        <FormField
          control={form.control}
          name="ftp"
          render={({ field, fieldState }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormLabel>{t('ftp')}</FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{t('ftpTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <FormControl>
                <Input
                  type="number"
                  placeholder={t('ftpPlaceholder')}
                  className="max-w-[200px]"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    field.onChange(value === '' ? null : parseInt(value, 10))
                  }}
                />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Max HR */}
        <FormField
          control={form.control}
          name="maxHr"
          render={({ field, fieldState }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormLabel>{t('maxHr')}</FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{t('maxHrTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <FormControl>
                <Input
                  type="number"
                  placeholder={t('maxHrPlaceholder')}
                  className="max-w-[200px]"
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    field.onChange(value === '' ? null : parseInt(value, 10))
                  }}
                />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Weight with unit conversion */}
        <FormField
          control={form.control}
          name="weightKg"
          render={({ field, fieldState }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormLabel>{t('weight')}</FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{t('weightTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <FormControl>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder={t('weightPlaceholder')}
                    className="max-w-[150px]"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? null : parseFloat(value))
                    }}
                  />
                  <div className="flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted/50 min-w-[60px] justify-center h-10">
                    {unitsSystem === 'metric' ? 'kg' : 'lbs'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUnitsToggle}
                    className="text-xs"
                  >
                    {unitsSystem === 'metric' ? t('metric') : t('imperial')}
                  </Button>
                </div>
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Auto-detect from Strava (disabled for now) */}
        <div className="pt-4 border-t">
          <Button type="button" variant="outline" disabled className="w-full">
            {t('autoDetectFromStrava')}
          </Button>
          <FormDescription className="text-center mt-2">
            {t('autoDetectDisabled')}
          </FormDescription>
        </div>

        {/* Skip info */}
        <p className="text-sm text-muted-foreground text-center italic">{t('skipAll')}</p>
      </form>
    </Form>
  )
}
