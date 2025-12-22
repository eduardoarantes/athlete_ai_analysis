# AWS Amplify Migration Plan

**Project:** Cycling AI Analysis
**Feature:** Migrate Next.js Web App from S3/CloudFront to AWS Amplify
**Status:** Planned
**Created:** 2025-12-22

---

## Executive Summary

Migrate the Next.js web application from the current (non-functional) S3/CloudFront static export deployment to AWS Amplify Hosting, which natively supports Next.js with SSR and API routes.

### Why Amplify?

| Current State | With Amplify |
|---------------|--------------|
| Static export fails (26 API routes) | Full Next.js support |
| Manual GitHub Actions deploy | Auto-deploy on push |
| No preview deployments | Preview URL per PR |
| Complex Terraform setup | Managed infrastructure |

### Estimated Effort

| Task | Time |
|------|------|
| Amplify setup | 15-30 minutes |
| Environment variables | 10 minutes |
| DNS configuration (if custom domain) | 15-30 minutes |
| Testing | 30 minutes |
| Cleanup old infrastructure | 15 minutes |
| **Total** | **~1.5-2 hours** |

---

## Architecture: Before & After

### Before (Broken)

```
GitHub ──push──▶ GitHub Actions ──build──▶ S3 + CloudFront
                                               ❌ Static only
                                               ❌ API routes fail
```

### After (Amplify)

```
GitHub ──push──▶ AWS Amplify ──deploy──▶ Amplify Hosting
                     │                        ✅ Full SSR
                     │                        ✅ API routes work
                     │                        ✅ Edge functions
                     ▼
              Preview URLs (per PR)
```

### Full System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           AWS                                    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    AWS Amplify                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Next.js App (SSR + API Routes)                     │  │  │
│  │  │                                                      │  │  │
│  │  │  Pages:                    API Routes:               │  │  │
│  │  │  • /dashboard              • /api/activities         │  │  │
│  │  │  • /coach                  • /api/auth/strava/*      │  │  │
│  │  │  • /reports                • /api/admin/*            │  │  │
│  │  │  • /settings               • /api/coach/*            │  │  │
│  │  │  • /activities             • /api/fit-files/*        │  │  │
│  │  │                            • /api/strava/*           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                         │                                  │  │
│  │  • Auto-deploy from GitHub                                │  │
│  │  • Preview deployments per PR                             │  │
│  │  • Built-in CDN (CloudFront)                              │  │
│  │  • Managed SSL certificates                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ NEXT_PUBLIC_API_URL               │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Lambda (Python FastAPI) - UNCHANGED                       │  │
│  │                                                            │  │
│  │  • /api/v1/plan/generate     (AI training plans)          │  │
│  │  • /api/v1/analysis          (Performance analysis)       │  │
│  │  • Heavy AI orchestration work                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Supabase                                  │
│  • PostgreSQL database                                           │
│  • Authentication (email, OAuth)                                 │
│  • Row Level Security                                            │
│  • Storage (FIT files)                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Access

- [ ] AWS Console access with permissions to create Amplify apps
- [ ] GitHub repository access (for Amplify connection)
- [ ] Current environment variable values (from GitHub Secrets or `.env`)

### Environment Variables Needed

```bash
# From your current GitHub Secrets
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=https://xxxxx.lambda-url.ap-southeast-2.on.aws

# Optional
NEXT_PUBLIC_STRAVA_CLIENT_ID=xxxxx
NEXT_PUBLIC_ENV=production
```

---

## Migration Steps

### Phase 1: Create Amplify App (AWS Console)

#### Step 1.1: Navigate to Amplify

1. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Ensure you're in the correct region: **ap-southeast-2** (Sydney)
3. Click **"Create new app"**

#### Step 1.2: Connect Repository

1. Select **"GitHub"** as the source
2. Click **"Next"**
3. Authorize AWS Amplify to access your GitHub account (if not already)
4. Select repository: **`eduardoarantes/athlete_ai_analysis`** (or your repo name)
5. Select branch: **`main`**
6. Click **"Next"**

#### Step 1.3: Configure Build Settings

Amplify should auto-detect Next.js. Verify/update the build settings:

**App name:** `cycling-ai-web`

**Build settings (amplify.yml):**

```yaml
version: 1
applications:
  - appRoot: web
    frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm
            - pnpm install --frozen-lockfile
        build:
          commands:
            - pnpm build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```

> **Note:** Do NOT set `NEXT_EXPORT=true` - we want full SSR mode.

#### Step 1.4: Add Environment Variables

In the Amplify Console, add these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase anon key (safe for client) |
| `NEXT_PUBLIC_API_URL` | `https://xxxxx.lambda-url...` | Your Python Lambda URL |
| `NEXT_PUBLIC_ENV` | `production` | Environment indicator |
| `NEXT_PUBLIC_STRAVA_CLIENT_ID` | `xxxxx` | If using Strava OAuth |

#### Step 1.5: Advanced Settings

1. **Framework:** Next.js - SSR (should be auto-detected)
2. **Node.js version:** 20
3. **Live package updates:** Enable (recommended)

#### Step 1.6: Deploy

1. Review settings
2. Click **"Save and deploy"**
3. Wait for initial build (~3-5 minutes)

---

### Phase 2: Configure Build Specification File

Create an `amplify.yml` file in the repository root for version-controlled build settings:

**File:** `amplify.yml`

```yaml
version: 1
applications:
  - appRoot: web
    frontend:
      phases:
        preBuild:
          commands:
            # Install pnpm
            - npm install -g pnpm
            # Install dependencies
            - pnpm install --frozen-lockfile
        build:
          commands:
            # Build Next.js in SSR mode (NOT static export)
            - pnpm build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*

    # Environment-specific settings
    environment:
      variables:
        NEXT_PUBLIC_ENV: production
```

---

### Phase 3: Update Next.js Configuration

Modify `web/next.config.ts` to handle Amplify deployment:

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Build modes:
// - NEXT_EXPORT=true: Static export (NOT used with Amplify)
// - NEXT_STANDALONE=true: Standalone build for Lambda
// - Neither: Standard SSR mode (used by Amplify)
const isStaticExport = process.env.NEXT_EXPORT === 'true'
const isStandalone = process.env.NEXT_STANDALONE === 'true'

const nextConfig: NextConfig = {
  // Configure output mode based on environment
  ...(isStaticExport
    ? { output: 'export' as const }
    : isStandalone
      ? { output: 'standalone' as const }
      : {}),  // Default: SSR mode for Amplify

  // Only needed for static export
  trailingSlash: isStaticExport,

  images: {
    unoptimized: isStaticExport,
  },

  // Remove reactCompiler - not recognized in Next.js 15
  // reactCompiler: true,  // REMOVE THIS LINE

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://127.0.0.1:54321 https://*.supabase.co https://*.lambda-url.*.on.aws",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
```

**Key changes:**
1. Remove `reactCompiler: true` (not a valid Next.js 15 option - this was causing warnings)
2. Only set `trailingSlash` for static export
3. Default mode is SSR (what Amplify uses)

---

### Phase 4: Configure Preview Deployments

#### Step 4.1: Enable Previews in Amplify

1. Go to Amplify Console → Your App → **Previews**
2. Click **"Enable previews"**
3. Select: **"Pull request previews"**
4. Install the Amplify GitHub App (if prompted)

#### Step 4.2: Configure Preview Settings

| Setting | Value |
|---------|-------|
| Pull request previews | Enabled |
| Preview branch pattern | `*` (all branches) or `feature/*` |
| Environment variables | Same as production (or separate if needed) |

Now every PR will get a unique preview URL like:
`https://pr-123.d1234abcd.amplifyapp.com`

---

### Phase 5: Configure Custom Domain (Optional)

If you have a custom domain:

#### Step 5.1: Add Domain in Amplify

1. Go to Amplify Console → Your App → **Domain management**
2. Click **"Add domain"**
3. Enter your domain: `cycling-ai.yourdomain.com`
4. Click **"Configure domain"**

#### Step 5.2: Update DNS Records

Amplify will provide DNS records to add:

| Type | Name | Value |
|------|------|-------|
| CNAME | `cycling-ai` | `d1234abcd.cloudfront.net` |
| CNAME | `_abc123.cycling-ai` | `_def456.acm-validations.aws` |

Add these to your DNS provider (Route53, Cloudflare, etc.)

#### Step 5.3: SSL Certificate

Amplify automatically provisions and manages SSL certificates via AWS Certificate Manager.

---

### Phase 6: Update GitHub Actions

#### Step 6.1: Remove Web Deploy Jobs

Edit `.github/workflows/deploy.yml`:

```yaml
# REMOVE or comment out these jobs:
# - build-web
# - deploy-web

# Keep these jobs:
# - test
# - build-lambda
# - terraform (if still using for Lambda)
# - deploy-lambda
```

#### Step 6.2: Simplified deploy.yml

```yaml
name: Deploy

on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'infrastructure/**'
      - 'requirements-lambda.txt'
      - '.github/workflows/deploy.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'prod'
        type: choice
        options:
          - dev
          - staging
          - prod
      deploy_lambda:
        description: 'Deploy Lambda function'
        required: false
        default: true
        type: boolean
      terraform_apply:
        description: 'Apply Terraform changes'
        required: false
        default: false
        type: boolean

env:
  AWS_REGION: ap-southeast-2
  PYTHON_VERSION: '3.11'
  TERRAFORM_VERSION: '1.6.0'
  TF_WORKSPACE: ${{ github.event.inputs.environment || 'prod' }}
  IS_MANUAL_DEPLOY: ${{ github.event_name == 'workflow_dispatch' }}

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      # ... existing test steps (unchanged)

  build-lambda:
    name: Build Lambda Package
    runs-on: ubuntu-latest
    needs: test
    # ... existing Lambda build steps (unchanged)

  # Web is now deployed by Amplify automatically
  # No build-web or deploy-web jobs needed

  deploy-lambda:
    name: Deploy Lambda (${{ github.event.inputs.environment || 'prod' }})
    runs-on: ubuntu-latest
    needs: [build-lambda]
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.deploy_lambda == 'true'
    # ... existing Lambda deploy steps (unchanged)
```

---

### Phase 7: Cleanup Old Infrastructure

#### Step 7.1: Remove S3/CloudFront (After Verification)

Once Amplify is working, remove unused resources:

**Option A: Via Terraform**
```bash
cd infrastructure/terraform
terraform destroy -target=aws_s3_bucket.web_bucket -target=aws_cloudfront_distribution.web
```

**Option B: Via AWS Console**
1. Empty and delete S3 bucket
2. Disable and delete CloudFront distribution

#### Step 7.2: Update Terraform Configuration

Remove web hosting resources from Terraform if no longer needed.

---

## Verification Checklist

### After Initial Deploy

- [ ] Amplify build completes successfully
- [ ] App loads at Amplify URL (`https://main.d1234abcd.amplifyapp.com`)
- [ ] Login/signup works (Supabase auth)
- [ ] Dashboard loads with data
- [ ] API routes work:
  - [ ] `/api/activities` returns data
  - [ ] `/api/auth/strava/status` responds
  - [ ] `/api/admin/stats` works (if admin)
- [ ] Strava OAuth flow works
- [ ] Coach/training plan wizard works
- [ ] Lambda API calls work (training plan generation)

### Preview Deployments

- [ ] Create test PR
- [ ] Preview URL is generated
- [ ] Preview build succeeds
- [ ] Preview app functions correctly

### Custom Domain (if configured)

- [ ] Domain resolves correctly
- [ ] SSL certificate is valid
- [ ] Redirects work (www → non-www or vice versa)

---

## Rollback Plan

If issues arise:

### Quick Rollback

1. **Disable Amplify auto-deploy:**
   - Amplify Console → App settings → General → Branch auto-build: OFF

2. **Re-enable old deploy:**
   - Uncomment `build-web` and `deploy-web` in GitHub Actions
   - Note: This will still fail due to API routes

### Full Rollback

1. Delete Amplify app
2. Restore S3/CloudFront infrastructure
3. Deploy web as static (will need to remove API routes or move to Lambda)

---

## Cost Estimate

### AWS Amplify Pricing

| Resource | Free Tier | After Free Tier |
|----------|-----------|-----------------|
| Build minutes | 1,000/month | $0.01/min |
| Hosting (GB served) | 15 GB/month | $0.15/GB |
| Hosting (requests) | 500,000/month | $0.0035/1000 |
| SSR compute | 500 hours/month | $0.0035/GB-hour |

### Estimated Monthly Cost

| Traffic Level | Estimated Cost |
|---------------|----------------|
| Low (hobby) | $0-5/month |
| Medium (100s users) | $5-20/month |
| High (1000s users) | $20-50/month |

**Comparison:**
- S3 + CloudFront (broken): ~$1-5/month
- Amplify (working): ~$5-20/month
- Vercel Pro: $20/month/member

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Build fails with "Cannot find module" | Missing dependencies | Ensure `pnpm install` runs in preBuild |
| API routes return 404 | Wrong build output | Verify `output` is NOT set to `export` |
| Environment variables undefined | Not set in Amplify | Add in Amplify Console → Environment variables |
| Build timeout | Large dependencies | Increase build timeout in Amplify settings |
| "Invalid next.config.ts options" | `reactCompiler` not valid | Remove `reactCompiler: true` from config |

### Viewing Logs

1. Amplify Console → Your App → Build history
2. Click on a build to see logs
3. Check "Deploy" phase for runtime errors

### Testing Locally with SSR

```bash
cd web
pnpm build  # Without NEXT_EXPORT=true
pnpm start  # Run SSR server locally
```

---

## Next Steps After Migration

1. **Monitor:** Set up CloudWatch alarms for Amplify
2. **Performance:** Enable Amplify performance insights
3. **Security:** Review Amplify access controls
4. **CI/CD:** Consider Amplify's built-in testing features

---

## Summary

| Step | Action | Time |
|------|--------|------|
| 1 | Create Amplify app in AWS Console | 15 min |
| 2 | Add `amplify.yml` to repo | 5 min |
| 3 | Update `next.config.ts` | 10 min |
| 4 | Enable preview deployments | 5 min |
| 5 | Configure custom domain (optional) | 15-30 min |
| 6 | Update GitHub Actions | 10 min |
| 7 | Cleanup old infrastructure | 15 min |
| 8 | Verify everything works | 30 min |

**Total: ~1.5-2 hours**
