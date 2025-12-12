'use client'

import { useTranslations } from 'next-intl'
import { ProgressIndicator } from './progress-indicator'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface WizardLayoutProps {
  currentStep: number
  totalSteps: number
  title: string
  subtitle: string
  children: React.ReactNode
  onNext: () => void
  onPrevious: () => void
  onSubmit?: () => void
  formId?: string
  isNextDisabled?: boolean
  isLoading?: boolean
}

export function WizardLayout({
  currentStep,
  totalSteps,
  title,
  subtitle,
  children,
  onNext: _onNext,
  onPrevious,
  onSubmit: _onSubmit,
  formId,
  isNextDisabled = false,
  isLoading = false,
}: WizardLayoutProps) {
  const t = useTranslations('common')
  const tOnboarding = useTranslations('onboarding')

  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === totalSteps

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{tOnboarding('title')}</h1>
          <p className="text-muted-foreground">{tOnboarding('subtitle')}</p>
        </div>

        {/* Progress Indicator */}
        <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />

        {/* Content Card */}
        <div className="bg-card border rounded-lg p-8 shadow-sm">
          {/* Step Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          {/* Step Content */}
          <div className="mb-8">{children}</div>

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={isFirstStep || isLoading}
              className="min-w-[120px]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Button>

            <Button
              type="submit"
              form={formId}
              disabled={isNextDisabled || isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                t('loading')
              ) : isLastStep ? (
                tOnboarding('completeSetup')
              ) : (
                <>
                  {t('next')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
