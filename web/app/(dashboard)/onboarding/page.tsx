'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { WizardLayout } from '@/components/onboarding/wizard-layout'
import { StepOne } from '@/components/onboarding/step-one'
import { StepTwo } from '@/components/onboarding/step-two'
import { StepThree } from '@/components/onboarding/step-three'
import { StepFour } from '@/components/onboarding/step-four'
import type {
  ProfileStepOneData,
  ProfileStepTwoData,
  ProfileStepThreeData,
  ProfileStepFourData,
} from '@/lib/validations/profile'

const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const t = useTranslations('onboarding.step1')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    currentStep,
    stepOneData,
    stepTwoData,
    stepThreeData,
    stepFourData,
    setStepOneData,
    setStepTwoData,
    setStepThreeData,
    setStepFourData,
    nextStep,
    previousStep,
    reset,
  } = useOnboardingStore()

  // Step submit handlers
  const handleStepOneSubmit = (data: ProfileStepOneData) => {
    setStepOneData(data)
    nextStep()
  }

  const handleStepTwoSubmit = (data: ProfileStepTwoData) => {
    setStepTwoData(data)
    nextStep()
  }

  const handleStepThreeSubmit = (data: ProfileStepThreeData) => {
    setStepThreeData(data)
    nextStep()
  }

  const handleStepFourSubmit = async (data: ProfileStepFourData) => {
    setStepFourData(data)
    // Final step - submit all data to create profile
    await handleCompleteOnboarding(data)
  }

  const handleCompleteOnboarding = async (finalStepData: ProfileStepFourData) => {
    // Validate all steps are complete
    if (!stepOneData || !stepTwoData || !stepThreeData) {
      toast.error('Please complete all previous steps')
      return
    }

    setIsSubmitting(true)

    try {
      // Combine all step data
      const completeProfile = {
        ...stepOneData,
        ...stepTwoData,
        ...stepThreeData,
        ...finalStepData,
      }

      // Call API to create profile
      const response = await fetch('/api/profile/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(completeProfile),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create profile')
      }

      // Success! Clear Zustand state
      reset()

      // Show success message
      toast.success('Profile created successfully!')

      // Redirect to dashboard immediately
      router.push('/dashboard')
    } catch (error) {
      console.error('Error creating profile:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create profile')
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    // For step 1, we need to trigger form validation
    // The form component will call handleStepOneSubmit if valid
    // For other steps, just move forward
    if (currentStep === 1) {
      // Form validation is handled in StepOne component
      // This will be updated when we add more steps
    } else {
      nextStep()
    }
  }

  const handlePrevious = () => {
    previousStep()
  }

  const tStep2 = useTranslations('onboarding.step2')
  const tStep3 = useTranslations('onboarding.step3')
  const tStep4 = useTranslations('onboarding.step4')

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <StepOne initialData={stepOneData} onSubmit={handleStepOneSubmit} />
      case 2:
        return <StepTwo initialData={stepTwoData} onSubmit={handleStepTwoSubmit} />
      case 3:
        return <StepThree initialData={stepThreeData} onSubmit={handleStepThreeSubmit} />
      case 4:
        return <StepFour initialData={stepFourData} onSubmit={handleStepFourSubmit} />
      default:
        return null
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return t('title')
      case 2:
        return tStep2('title')
      case 3:
        return tStep3('title')
      case 4:
        return tStep4('title')
      default:
        return ''
    }
  }

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 1:
        return t('subtitle')
      case 2:
        return tStep2('subtitle')
      case 3:
        return tStep3('subtitle')
      case 4:
        return tStep4('subtitle')
      default:
        return ''
    }
  }

  const getCurrentFormId = () => {
    switch (currentStep) {
      case 1:
        return 'step-one-form'
      case 2:
        return 'step-two-form'
      case 3:
        return 'step-three-form'
      case 4:
        return 'step-four-form'
      default:
        return ''
    }
  }

  return (
    <>
      <Toaster position="top-center" />
      <WizardLayout
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        title={getStepTitle()}
        subtitle={getStepSubtitle()}
        onNext={handleNext}
        onPrevious={handlePrevious}
        formId={getCurrentFormId()}
        isNextDisabled={isSubmitting}
      >
        {renderStepContent()}
      </WizardLayout>
    </>
  )
}
