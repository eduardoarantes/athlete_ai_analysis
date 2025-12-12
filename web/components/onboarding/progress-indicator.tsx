'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  const t = useTranslations('onboarding')

  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1)

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      {/* Progress text */}
      <p className="text-sm text-muted-foreground text-center mb-4">
        {t('stepProgress', { current: currentStep, total: totalSteps })}
      </p>

      {/* Progress bar */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const isUpcoming = step > currentStep

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    {
                      'border-primary bg-primary text-primary-foreground': isCurrent || isCompleted,
                      'border-muted bg-background text-muted-foreground': isUpcoming,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step}</span>
                  )}
                </div>
                {/* Step label */}
                <span
                  className={cn('mt-2 text-xs font-medium hidden sm:block', {
                    'text-foreground': isCurrent,
                    'text-muted-foreground': !isCurrent,
                  })}
                >
                  Step {step}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn('h-0.5 flex-1 mx-2 transition-all', {
                    'bg-primary': step < currentStep,
                    'bg-muted': step >= currentStep,
                  })}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
