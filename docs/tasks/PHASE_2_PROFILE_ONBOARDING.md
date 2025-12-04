# Phase 2: Profile & Onboarding - Task Breakdown

**Duration:** Weeks 3-4  
**Goal:** Complete profile setup wizard and internationalization  
**Status:** Pending Phase 1 Completion

---

## Overview

Phase 2 builds the onboarding experience that guides new users through profile setup. By the end, users will complete a 4-step wizard with multi-language support.

### Key Deliverables

- ✅ 4-step profile setup wizard with validation
- ✅ Internationalization support (EN, PT, ES, FR)
- ✅ Profile CRUD operations with auto-save
- ✅ Form validation with Zod schemas
- ✅ Responsive wizard UI

### Prerequisites

- Phase 1 completed (auth working, database schema deployed)
- User can sign up and log in
- Database tables ready for profile data

---

## Task Breakdown

### Week 3: Onboarding Wizard

#### P2-T1: Set Up Internationalization (next-intl)

**Estimated Effort:** 3 hours

**Steps:**
1. Install next-intl
2. Create locale configuration
3. Set up middleware for locale detection
4. Create translation files (en, pt, es, fr)
5. Update app structure for [locale] routes

**Commands:**
```bash
pnpm add next-intl
```

**Files to Create:**
- `i18n/config.ts` - i18n configuration
- `i18n/locales/en.json` - English translations
- `i18n/locales/pt.json` - Portuguese translations
- `i18n/locales/es.json` - Spanish translations
- `i18n/locales/fr.json` - French translations
- `middleware.ts` - Update for locale handling
- `app/[locale]/layout.tsx` - Root layout with locale

**Acceptance Criteria:**
- [ ] Routes work with locale prefix (/en/dashboard, /pt/dashboard)
- [ ] Browser language auto-detected
- [ ] Language switcher component working
- [ ] All translations loading correctly

---

#### P2-T2: Create Zod Schemas for Profile Validation

**Estimated Effort:** 2 hours

**Files to Create:**
- `lib/validations/profile.ts`

**Schema Example:**
```typescript
import { z } from 'zod'

export const profileStepOneSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
})

export const profileStepTwoSchema = z.object({
  ftp: z.number().int().positive().nullable(),
  maxHr: z.number().int().min(100).max(220).nullable(),
  weightKg: z.number().positive().nullable(),
})

export const profileStepThreeSchema = z.object({
  goals: z.array(z.string()).min(1, 'Select at least one goal'),
})

export const profileStepFourSchema = z.object({
  preferredLanguage: z.enum(['en', 'pt', 'es', 'fr']),
  timezone: z.string(),
  unitsSystem: z.enum(['metric', 'imperial']),
})

export const completeProfileSchema = profileStepOneSchema
  .merge(profileStepTwoSchema)
  .merge(profileStepThreeSchema)
  .merge(profileStepFourSchema)
```

**Acceptance Criteria:**
- [ ] All validation schemas defined
- [ ] Schemas match database constraints
- [ ] Type inference working (`z.infer<>`)

---

#### P2-T3: Build Step 1 - Basic Info

**Estimated Effort:** 3 hours

**Files to Create:**
- `app/[locale]/(onboarding)/onboarding/page.tsx`
- `components/onboarding/step-one.tsx`
- `components/onboarding/wizard-layout.tsx`
- `components/onboarding/progress-indicator.tsx`

**Acceptance Criteria:**
- [ ] Step 1 form with first name, last name, age, gender
- [ ] Client-side validation working
- [ ] Progress indicator shows "Step 1 of 4"
- [ ] Next button enabled only when valid
- [ ] Form state persisted to localStorage (temp)

---

#### P2-T4: Build Step 2 - Performance Metrics

**Estimated Effort:** 3 hours

**Features:**
- FTP input with tooltip explaining what FTP is
- Max HR input with age-based suggestion
- Weight input with unit conversion (kg/lbs)
- "Skip" option for each field

**Acceptance Criteria:**
- [ ] All inputs with proper validation
- [ ] Unit conversion working (metric/imperial toggle)
- [ ] "Auto-detect from Strava" button (disabled, placeholder for Phase 3)
- [ ] Can skip all fields and continue

---

#### P2-T5: Build Step 3 - Goals Selection

**Estimated Effort:** 2 hours

**Features:**
- Preset goals as checkboxes
- Custom goal text input
- Minimum 1 goal required

**Preset Goals:**
- Improve FTP
- Complete a century ride
- Train for a race
- Build endurance
- Weight loss
- Maintain fitness

**Acceptance Criteria:**
- [ ] Multiple goals can be selected
- [ ] Custom goal can be added
- [ ] At least one goal required
- [ ] Goals saved as JSON array

---

#### P2-T6: Build Step 4 - Preferences

**Estimated Effort:** 2 hours

**Features:**
- Language selector (en, pt, es, fr)
- Units system toggle (metric/imperial)
- Timezone selector with auto-detect

**Acceptance Criteria:**
- [ ] Language changes UI immediately
- [ ] Timezone auto-detected from browser
- [ ] Units system defaults to metric
- [ ] "Complete Setup" button submits all steps

---

#### P2-T7: Implement Wizard Navigation and State Management

**Estimated Effort:** 3 hours

**Features:**
- Zustand store for wizard state
- Next/Back navigation
- Form data persistence across steps
- Submit all data at end

**Files to Create:**
- `lib/stores/onboarding-store.ts`

**Store Example:**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  currentStep: number
  stepOneData: ProfileStepOneData | null
  stepTwoData: ProfileStepTwoData | null
  stepThreeData: ProfileStepThreeData | null
  stepFourData: ProfileStepFourData | null
  setCurrentStep: (step: number) => void
  setStepData: (step: number, data: any) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      stepOneData: null,
      stepTwoData: null,
      stepThreeData: null,
      stepFourData: null,
      setCurrentStep: (step) => set({ currentStep: step }),
      setStepData: (step, data) => set({ [`step${step}Data`]: data }),
      reset: () => set({
        currentStep: 1,
        stepOneData: null,
        stepTwoData: null,
        stepThreeData: null,
        stepFourData: null,
      }),
    }),
    { name: 'onboarding-storage' }
  )
)
```

**Acceptance Criteria:**
- [ ] Can navigate back without losing data
- [ ] Can navigate forward with validation
- [ ] State persisted to localStorage
- [ ] State cleared after submission

---

### Week 4: Profile Management

#### P2-T8: Create Profile API Routes

**Estimated Effort:** 3 hours

**Files to Create:**
- `app/api/profile/route.ts` - GET/PUT profile
- `app/api/profile/create/route.ts` - POST create profile
- `lib/services/profile-service.ts` - Business logic

**API Routes:**
```typescript
// app/api/profile/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from('athlete_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  const { data: profile, error } = await supabase
    .from('athlete_profiles')
    .update(body)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
```

**Acceptance Criteria:**
- [ ] GET /api/profile returns user profile
- [ ] PUT /api/profile updates profile
- [ ] POST /api/profile/create creates profile
- [ ] RLS policies enforced
- [ ] Validation errors returned properly

---

#### P2-T9: Create Onboarding Completion Handler

**Estimated Effort:** 2 hours

**Features:**
- Collect all wizard data
- Create athlete_profiles record
- Clear wizard state
- Redirect to dashboard

**Acceptance Criteria:**
- [ ] All 4 steps' data combined
- [ ] Profile created in database
- [ ] Wizard state cleared
- [ ] User redirected to dashboard
- [ ] Success message shown

---

#### P2-T10: Build Profile Settings Page

**Estimated Effort:** 4 hours

**Features:**
- View current profile
- Edit all profile fields
- Auto-save on change (debounced)
- Success/error toast notifications

**Files to Create:**
- `app/[locale]/(dashboard)/settings/page.tsx`
- `components/profile/profile-form.tsx`
- `lib/hooks/use-auto-save.ts`

**Auto-save Hook:**
```typescript
import { useEffect, useRef } from 'react'
import { useDebouncedCallback } from 'use-debounce'

export function useAutoSave(
  data: any,
  onSave: (data: any) => Promise<void>,
  delay = 1000
) {
  const previousData = useRef(data)

  const debouncedSave = useDebouncedCallback(async (newData) => {
    if (JSON.stringify(newData) !== JSON.stringify(previousData.current)) {
      await onSave(newData)
      previousData.current = newData
    }
  }, delay)

  useEffect(() => {
    debouncedSave(data)
  }, [data, debouncedSave])
}
```

**Acceptance Criteria:**
- [ ] Profile loads from database
- [ ] Changes auto-saved after 1 second
- [ ] Toast notification on save success
- [ ] Error handling with toast
- [ ] Loading state during save

---

#### P2-T11: Add Language Switcher Component

**Estimated Effort:** 2 hours

**Files to Create:**
- `components/layout/language-switcher.tsx`

**Features:**
- Dropdown with flag icons
- Change locale and reload page
- Remember selection in profile

**Acceptance Criteria:**
- [ ] Switcher in navbar
- [ ] Languages: EN, PT, ES, FR
- [ ] Page reloads with new locale
- [ ] Preference saved to database

---

#### P2-T12: Create Comprehensive Translation Files

**Estimated Effort:** 4 hours

**Translate all UI text:**
- Common labels (Next, Back, Save, Cancel)
- Auth pages (Login, Signup, etc.)
- Onboarding wizard steps
- Dashboard labels
- Error messages
- Validation messages

**Files:**
- `i18n/locales/en.json` (master)
- `i18n/locales/pt.json`
- `i18n/locales/es.json`
- `i18n/locales/fr.json`

**Acceptance Criteria:**
- [ ] All UI text translatable
- [ ] No hardcoded strings in components
- [ ] Validation messages translated
- [ ] Date/number formatting by locale

---

## Phase Completion Checklist

### Onboarding
- [ ] 4-step wizard functional
- [ ] All validation working
- [ ] Progress indicator clear
- [ ] Can navigate back/forward
- [ ] State persisted correctly
- [ ] Completes successfully

### Profile Management
- [ ] Profile API routes working
- [ ] Profile creation on completion
- [ ] Settings page functional
- [ ] Auto-save working
- [ ] No data loss

### Internationalization
- [ ] 4 languages supported
- [ ] Language switcher working
- [ ] All text translated
- [ ] Locale-aware formatting
- [ ] Browser language detected

### Testing
- [ ] All forms validated
- [ ] TypeScript errors resolved
- [ ] Manual testing complete
- [ ] CI pipeline passing

---

## Success Criteria

1. New user completes onboarding in < 3 minutes
2. Profile created successfully in database
3. Language switching works seamlessly
4. Auto-save working without errors
5. Mobile responsive wizard
6. All validation messages clear
7. No console errors

**Handoff to Phase 3:**
- Profile system complete
- Ready for Strava integration
- Auto-detect FTP/HR can be implemented
- i18n foundation solid

---

**Phase 2 Task Breakdown - v1.0**  
**Last Updated:** 2025-12-03
