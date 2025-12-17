'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, ArrowRight, Sparkles, AlertCircle, AlertTriangle } from 'lucide-react'
import { GoalStep } from './components/goal-step'
import { TimelineStep } from './components/timeline-step'
import { ProfileStep } from './components/profile-step'
import { ReviewStep } from './components/review-step'
import { AIAssistant } from './components/ai-assistant'

interface WizardData {
  goal?: string
  timeline?: {
    hasEvent: boolean
    eventDate?: string
    eventType?: string
    weeks?: number
  }
  profile?: {
    ftp: number
    weight: number
    maxHR: number
    weeklyHours: string
    experienceLevel: string
    trainingDays: string[]
  }
}

const STEP_KEYS = ['goal', 'timeline', 'profile', 'review'] as const

const STEP_COMPONENTS = [GoalStep, TimelineStep, ProfileStep, ReviewStep]

export default function CreateTrainingPlanPage() {
  const router = useRouter()
  const t = useTranslations('createPlan')
  const [currentStep, setCurrentStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [aiSuggestion, setAiSuggestion] = useState<string>('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])

  // Load initial data and saved wizard state
  useEffect(() => {
    const initializeWizard = async () => {
      setIsInitializing(true)
      try {
        // Load profile data
        const initResponse = await fetch('/api/coach/wizard/initialize')
        const initData = await initResponse.json()

        // Try to load saved session
        const sessionResponse = await fetch('/api/coach/wizard/session')
        const sessionData = await sessionResponse.json()

        if (sessionData.session) {
          // Resume from saved session
          setWizardData(sessionData.session.wizardData)
          setCurrentStep(sessionData.session.currentStep)
        } else {
          // Fresh start - pre-populate profile data
          setWizardData({
            profile: {
              ftp: initData.profile.ftp || 0,
              weight: initData.profile.weight || 0,
              maxHR: initData.profile.maxHR || 0,
              weeklyHours: '',
              experienceLevel: initData.experienceLevel || 'intermediate',
              trainingDays: ['monday', 'wednesday', 'friday', 'saturday'],
            },
          })
        }
      } catch (error) {
        console.error('Failed to initialize wizard:', error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeWizard()
  }, [])

  // Save wizard state whenever data or step changes
  useEffect(() => {
    const saveSession = async () => {
      // Don't save if wizard data is empty (initial state)
      if (Object.keys(wizardData).length === 0) return

      try {
        await fetch('/api/coach/wizard/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wizardData,
            currentStep,
          }),
        })
      } catch (error) {
        console.error('Failed to save session:', error)
      }
    }

    // Debounce the save to avoid too many requests
    const timeoutId = setTimeout(saveSession, 500)
    return () => clearTimeout(timeoutId)
  }, [wizardData, currentStep])

  // Get AI suggestions when step changes
  useEffect(() => {
    const fetchAISuggestion = async () => {
      if (Object.keys(wizardData).length === 0) return

      try {
        const response = await fetch('/api/coach/wizard/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: STEP_KEYS[currentStep - 1] || '',
            currentData: wizardData,
          }),
        })
        const data = await response.json()
        setAiSuggestion(data.suggestion || '')
      } catch (error) {
        console.error('Failed to fetch AI suggestion:', error)
      }
    }

    fetchAISuggestion()
  }, [currentStep, wizardData])

  const handleStepData = (stepData: Partial<WizardData>) => {
    // Clear validation errors when user makes changes
    setValidationErrors([])
    setWizardData((prev) => ({ ...prev, ...stepData }))
  }

  const handleNext = async () => {
    // Validate current step before proceeding
    setIsLoading(true)
    try {
      const response = await fetch('/api/coach/wizard/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: STEP_KEYS[currentStep - 1] || '',
          data: wizardData,
        }),
      })

      const validation = await response.json()

      // Always update warnings (even if valid)
      setValidationWarnings(validation.warnings || [])

      if (validation.valid) {
        // Clear errors and proceed
        setValidationErrors([])
        if (currentStep === STEP_KEYS.length) {
          // Final step - generate plan
          await handleGeneratePlan()
        } else {
          setCurrentStep((prev) => prev + 1)
        }
      } else {
        // Show validation errors
        setValidationErrors(validation.errors || [])
      }
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    // Clear validation messages when going back
    setValidationErrors([])
    setValidationWarnings([])
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleGeneratePlan = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/coach/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardData),
      })

      const { jobId } = await response.json()

      // Clear wizard session since plan is being generated
      await fetch('/api/coach/wizard/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      // Redirect to job status page
      router.push(`/coach/plan/status/${jobId}`)
    } catch (error) {
      console.error('Failed to generate plan:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentStepKey = STEP_KEYS[currentStep - 1]
  const StepComponent = STEP_COMPONENTS[currentStep - 1] || GoalStep
  const progress = (currentStep / STEP_KEYS.length) * 100

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="container max-w-5xl py-8 mx-auto">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('loading')}</p>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl py-8 mx-auto">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </div>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            {STEP_KEYS.map((stepKey, index) => (
              <div
                key={stepKey}
                className={`flex-1 text-center ${
                  index + 1 === currentStep
                    ? 'text-primary font-semibold'
                    : index + 1 < currentStep
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                }`}
              >
                {t(`steps.${stepKey}`)}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wizard Step */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('stepTitle', { step: currentStep, name: t(`steps.${currentStepKey}`) })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StepComponent
                  key={`step-${currentStep}`}
                  data={wizardData}
                  onUpdate={handleStepData}
                />

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive" className="mt-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Validation Warnings */}
                {validationWarnings.length > 0 && (
                  <Alert className="mt-4 border-yellow-500 bg-yellow-50 text-yellow-800">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <ul className="list-disc list-inside space-y-1">
                        {validationWarnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isLoading}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t('back')}
                  </Button>

                  <Button onClick={handleNext} disabled={isLoading}>
                    {isLoading ? (
                      t('processing')
                    ) : currentStep === STEP_KEYS.length ? (
                      t('generatePlan')
                    ) : (
                      <>
                        {t('next')}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Assistant Sidebar */}
          <div className="lg:col-span-1">
            <AIAssistant suggestion={aiSuggestion} wizardData={wizardData} />
          </div>
        </div>
      </div>
    </div>
  )
}
