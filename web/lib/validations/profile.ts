import { z } from 'zod'

// Step 1: Basic Information
export const profileStepOneSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  age: z
    .any()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) {
        return undefined
      }
      const parsed = Number(val)
      return isNaN(parsed) ? undefined : parsed
    })
    .refine((val): val is number => val !== undefined, 'Please enter your age')
    .pipe(
      z
        .number()
        .int('Age must be a whole number')
        .positive('Please enter a valid age')
        .min(13, 'You must be at least 13 years old')
        .max(120, 'Please enter a realistic age')
    ),
  gender: z
    .string({ message: 'Please select your gender' })
    .min(1, 'Please select your gender')
    .refine((val) => ['male', 'female', 'other', 'prefer_not_to_say'].includes(val), {
      message: 'Please select your gender',
    }),
})

export type ProfileStepOneData = z.infer<typeof profileStepOneSchema>

// Step 2: Performance Metrics
export const profileStepTwoSchema = z.object({
  ftp: z
    .number()
    .int()
    .positive('FTP must be positive')
    .max(999, 'FTP must be at most 999')
    .nullable(),
  maxHr: z
    .number()
    .int()
    .min(100, 'Max HR must be at least 100')
    .max(220, 'Max HR must be at most 220')
    .nullable(),
  restingHr: z
    .number()
    .int()
    .min(30, 'Resting HR must be at least 30')
    .max(100, 'Resting HR must be at most 100')
    .nullable(),
  lthr: z
    .number()
    .int()
    .min(40, 'LTHR must be at least 40')
    .max(220, 'LTHR must be at most 220')
    .nullable(),
  weightKg: z.number().positive('Weight must be positive').nullable(),
  unitsSystem: z.enum(['metric', 'imperial']),
})

export type ProfileStepTwoData = z.infer<typeof profileStepTwoSchema>

// Step 3: Training Goals
export const profileStepThreeSchema = z.object({
  goals: z
    .array(z.string())
    .min(1, 'Please select at least one goal')
    .max(10, 'Too many goals selected'),
})

export type ProfileStepThreeData = z.infer<typeof profileStepThreeSchema>

// Predefined goals
export const PRESET_GOALS = [
  'improve_ftp',
  'complete_century',
  'train_for_race',
  'build_endurance',
  'weight_loss',
  'maintain_fitness',
] as const

export type PresetGoal = (typeof PRESET_GOALS)[number]

// Step 4: Preferences
export const profileStepFourSchema = z.object({
  preferredLanguage: z.enum(['en', 'pt', 'es', 'fr']),
  timezone: z.string().min(1, 'Timezone is required'),
})

export type ProfileStepFourData = z.infer<typeof profileStepFourSchema>

// Complete profile combining all steps
export const completeProfileSchema = profileStepOneSchema
  .merge(profileStepTwoSchema)
  .merge(profileStepThreeSchema)
  .merge(profileStepFourSchema)

export type CompleteProfileData = z.infer<typeof completeProfileSchema>

// Database profile schema (matches athlete_profiles table)
export const athleteProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  age: z.number().int(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  ftp: z.number().int().nullable(),
  maxHr: z.number().int().nullable(),
  restingHr: z.number().int().nullable(),
  lthr: z.number().int().nullable(),
  weightKg: z.number().nullable(),
  goals: z.array(z.string()),
  preferredLanguage: z.enum(['en', 'pt', 'es', 'fr']),
  timezone: z.string(),
  unitsSystem: z.enum(['metric', 'imperial']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type AthleteProfile = z.infer<typeof athleteProfileSchema>

// Partial update schema (for profile edits)
export const updateProfileSchema = completeProfileSchema.partial()

export type UpdateProfileData = z.infer<typeof updateProfileSchema>
