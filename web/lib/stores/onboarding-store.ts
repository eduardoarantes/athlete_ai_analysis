import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ProfileStepOneData,
  ProfileStepTwoData,
  ProfileStepThreeData,
  ProfileStepFourData,
} from '@/lib/validations/profile'

interface OnboardingState {
  currentStep: number
  stepOneData: ProfileStepOneData | null
  stepTwoData: ProfileStepTwoData | null
  stepThreeData: ProfileStepThreeData | null
  stepFourData: ProfileStepFourData | null
  setCurrentStep: (step: number) => void
  setStepOneData: (data: ProfileStepOneData) => void
  setStepTwoData: (data: ProfileStepTwoData) => void
  setStepThreeData: (data: ProfileStepThreeData) => void
  setStepFourData: (data: ProfileStepFourData) => void
  nextStep: () => void
  previousStep: () => void
  reset: () => void
}

const TOTAL_STEPS = 4

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      stepOneData: null,
      stepTwoData: null,
      stepThreeData: null,
      stepFourData: null,

      setCurrentStep: (step) => {
        if (step >= 1 && step <= TOTAL_STEPS) {
          set({ currentStep: step })
        }
      },

      setStepOneData: (data) => set({ stepOneData: data }),
      setStepTwoData: (data) => set({ stepTwoData: data }),
      setStepThreeData: (data) => set({ stepThreeData: data }),
      setStepFourData: (data) => set({ stepFourData: data }),

      nextStep: () => {
        const { currentStep } = get()
        if (currentStep < TOTAL_STEPS) {
          set({ currentStep: currentStep + 1 })
        }
      },

      previousStep: () => {
        const { currentStep } = get()
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 })
        }
      },

      reset: () =>
        set({
          currentStep: 1,
          stepOneData: null,
          stepTwoData: null,
          stepThreeData: null,
          stepFourData: null,
        }),
    }),
    {
      name: 'onboarding-storage',
      // Only persist data, not currentStep (restart from step 1 on reload)
      partialize: (state) => ({
        stepOneData: state.stepOneData,
        stepTwoData: state.stepTwoData,
        stepThreeData: state.stepThreeData,
        stepFourData: state.stepFourData,
      }),
    }
  )
)
