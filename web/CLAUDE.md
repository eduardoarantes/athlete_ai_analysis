# Cycling AI Web Application - Claude Code Guide

**Project:** Next.js web application for cycling performance analysis
**Framework:** Next.js 16 with App Router, TypeScript, Tailwind CSS, shadcn/ui

---

## Code Quality Checks (REQUIRED)

**Before committing changes, run these checks:**

```bash
# 1. TypeScript - requires full project context for path aliases and JSX
pnpm type-check

# 2. Lint only changed TypeScript/TSX files
pnpm lint $(git diff --name-only --diff-filter=ACMR main | grep -E '\.(ts|tsx)$')

# 3. Format check only changed files
pnpm format:check $(git diff --name-only --diff-filter=ACMR main)
```

**If format issues are found, auto-fix with:**

```bash
pnpm format $(git diff --name-only --diff-filter=ACMR main)
```

**Do not commit if there are:**

- TypeScript type errors in files you modified
- ESLint errors (pre-existing warnings in unchanged files are acceptable)
- Formatting issues in files you modified

**Note:** Only fix issues in files you modified. Do not fix pre-existing issues in unrelated files.

---

## Field Validation Pattern

When implementing form validation that communicates with an API, follow this pattern to ensure validation errors are displayed to users.

### 1. Add State for Validation Messages

```typescript
const [validationErrors, setValidationErrors] = useState<string[]>([])
const [validationWarnings, setValidationWarnings] = useState<string[]>([])
```

### 2. Handle Validation in Submit/Next Handler

```typescript
const handleNext = async () => {
  setIsLoading(true)
  try {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: currentStep, data: formData }),
    })

    const validation = await response.json()

    // Always update warnings (shown even if valid)
    setValidationWarnings(validation.warnings || [])

    if (validation.valid) {
      // Clear errors and proceed
      setValidationErrors([])
      // ... proceed to next step
    } else {
      // Display validation errors
      setValidationErrors(validation.errors || [])
    }
  } catch (error) {
    console.error('Validation failed:', error)
  } finally {
    setIsLoading(false)
  }
}
```

### 3. Clear Errors When User Makes Changes

```typescript
const handleFieldChange = (newData: Partial<FormData>) => {
  // Clear validation errors when user modifies the form
  setValidationErrors([])
  setFormData((prev) => ({ ...prev, ...newData }))
}
```

### 4. Clear Errors on Navigation

```typescript
const handleBack = () => {
  setValidationErrors([])
  setValidationWarnings([])
  setCurrentStep((prev) => prev - 1)
}
```

### 5. Display Validation UI

Use the Alert component from shadcn/ui to display errors and warnings:

```typescript
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, AlertTriangle } from 'lucide-react'

// In your JSX:

{/* Validation Errors - Red destructive alert */}
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

{/* Validation Warnings - Yellow alert */}
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
```

### 6. API Validation Response Format

Validation APIs should return a consistent response format:

```typescript
// API Route: /api/validate/route.ts
export async function POST(request: NextRequest) {
  const { step, data } = await request.json()

  const errors: string[] = []
  const warnings: string[] = []

  // Validate based on step
  switch (step) {
    case 'profile':
      if (!data.profile?.ftp || data.profile.ftp <= 0) {
        errors.push('Please enter your FTP')
      }
      if (!data.profile?.weight || data.profile.weight <= 0) {
        errors.push('Please enter your weight')
      }
      break

    case 'preferences':
      if (data.preferences?.daysPerWeek < 3) {
        warnings.push('Training less than 3 days per week may limit progress')
      }
      if (!data.preferences?.workoutTypes?.length) {
        errors.push('Please select at least one workout type')
      }
      break
  }

  return NextResponse.json({
    valid: errors.length === 0,
    errors,
    warnings,
  })
}
```

### Key Principles

1. **Never just log errors** - Always display validation feedback to users
2. **Clear errors on change** - Remove error messages when users modify the form
3. **Distinguish errors from warnings** - Errors block progression, warnings inform but allow continuation
4. **Use consistent styling** - Red for errors, yellow for warnings
5. **List multiple errors** - Show all validation issues at once, not one at a time

---

## Logging Guidelines

**NEVER use `console.log` or `console.error` in production code.** Always use the structured `errorLogger` from `@/lib/monitoring/error-logger`.

### Import the Logger

```typescript
import { errorLogger } from '@/lib/monitoring/error-logger'
```

### Logging Methods

The errorLogger provides three severity levels:

```typescript
// For informational messages (successful operations, status updates)
errorLogger.logInfo('Webhook event received', {
  userId: user.id, // Optional: Associate with user
  metadata: {
    // Optional: Additional context
    objectType: event.type,
    objectId: event.id,
  },
})

// For warnings (non-critical issues, recoverable errors)
errorLogger.logWarning('User not found for athlete', {
  path: '/api/webhooks/strava',
  metadata: { athleteId: event.owner_id },
})

// For errors (exceptions, failures that need attention)
errorLogger.logError(error as Error, {
  userId: user.id,
  path: '/api/profile/create',
  method: 'POST',
  metadata: { additionalContext: 'value' },
})
```

### Common Patterns

**API Route Error Handling:**

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... operation logic

    errorLogger.logInfo('Operation completed', {
      userId: user.id,
      metadata: { operationType: 'create' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/your-endpoint',
      method: 'POST',
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

**Service Layer Logging:**

```typescript
async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  errorLogger.logInfo('Processing webhook event', {
    metadata: { eventId: event.id, type: event.type },
  })

  try {
    // ... processing logic

    errorLogger.logInfo('Webhook processed successfully', {
      metadata: { eventId: event.id },
    })
  } catch (error) {
    errorLogger.logError(error as Error, {
      path: '/api/webhooks',
      metadata: { eventId: event.id, phase: 'processing' },
    })
    throw error
  }
}
```

### Key Principles

1. **Never log sensitive data** - Don't log passwords, tokens, full emails, or PII
2. **Include context** - Always include relevant IDs (userId, objectId, etc.)
3. **Use appropriate severity** - Info for success, Warning for recoverable issues, Error for failures
4. **Include path/method** - For API routes, always include the endpoint path
5. **Structure metadata** - Use the metadata object for additional context

---

## Custom Hooks

### useIsAdmin

Use the `useIsAdmin` hook to check if the current user has admin privileges. This hook calls the Supabase `is_admin()` RPC function and caches the result.

**Location:** `@/lib/hooks/use-is-admin`

**Usage:**

```typescript
import { useIsAdmin } from '@/lib/hooks/use-is-admin'

function MyComponent() {
  const isAdmin = useIsAdmin()

  if (!isAdmin) return null

  return <div>Admin-only content</div>
}
```

**Key Points:**

- Returns `false` initially, then updates after the RPC call completes
- Result is cached for the component lifetime
- Use this hook instead of manually calling `supabase.rpc('is_admin')` to avoid duplicate RPC calls

---

## Project Structure

```
web/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (login, register)
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── dashboard/        # Dashboard-specific components
├── lib/                   # Utilities and services
│   ├── supabase/         # Supabase client
│   ├── services/         # Business logic services
│   └── hooks/            # Custom React hooks
├── messages/             # i18n translation files
└── supabase/             # Database migrations
```

---

## Common Commands

```bash
# Development
pnpm dev                  # Start dev server
pnpm build               # Production build
pnpm type-check          # TypeScript check
pnpm lint                # ESLint

# Testing
pnpm test:unit:run       # Run unit tests
pnpm test:headed         # Run E2E tests with browser

# Database
npx supabase migration new <name>  # Create migration
npx supabase db push              # Apply migrations

# Supabase Types (IMPORTANT)
npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
```

---

## Supabase Type Generation (REQUIRED)

**After adding/modifying database columns, you MUST regenerate Supabase types:**

```bash
npx supabase gen types typescript --project-id smzefukhxabhjwdxhuhm --schema public > lib/types/database.ts
```

**When to regenerate:**

- After running `npx supabase db push` with new migrations
- After adding new columns to existing tables
- After creating new tables
- When you see `SelectQueryError` TypeScript errors about missing columns

**Important:**

- Types file location: `lib/types/database.ts` (NOT `lib/supabase/database.types.ts`)
- The Supabase client imports types from `@/lib/types/database`
- Do NOT use type assertions (`as any`) to work around missing column types - regenerate types instead
