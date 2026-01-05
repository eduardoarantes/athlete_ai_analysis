import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Build modes:
// - NEXT_EXPORT=true: Static export for S3/CloudFront (no API routes)
// - NEXT_STANDALONE=true: Standalone build for Lambda deployment (includes API routes)
// - Neither: Development mode with full SSR
const isStaticExport = process.env.NEXT_EXPORT === 'true'
const isStandalone = process.env.NEXT_STANDALONE === 'true'

const nextConfig: NextConfig = {
  // Configure output mode based on environment
  ...(isStaticExport
    ? { output: 'export' as const }
    : isStandalone
      ? { output: 'standalone' as const }
      : {}),
  // Required for static export
  trailingSlash: true,
  // Disable image optimization for static export (use unoptimized images)
  images: {
    unoptimized: isStaticExport,
  },
  // Server-side runtime configuration (embedded at build time)
  // Used for credentials in Amplify SSR where env vars aren't available at runtime
  serverRuntimeConfig: {
    stravaClientId: process.env.STRAVA_CLIENT_ID,
    stravaClientSecret: process.env.STRAVA_CLIENT_SECRET,
    stravaWebhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Note: Lambda is called via HTTP to function URL (not SDK)
    // See GitHub issue #37 for secure BFF with SSM credentials
  },
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
              // Allow connections to Supabase and Lambda API (both local and production)
              "connect-src 'self' http://127.0.0.1:54321 https://*.supabase.co https://*.lambda-url.*.on.aws",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
