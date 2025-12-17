import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  // Enable static export for S3/CloudFront deployment
  // Note: Set NEXT_EXPORT=true in CI/CD to enable static export
  // Local development keeps SSR for better DX
  output: process.env.NEXT_EXPORT === 'true' ? 'export' : undefined,
  // Required for static export
  trailingSlash: true,
  // Disable image optimization for static export (use unoptimized images)
  images: {
    unoptimized: process.env.NEXT_EXPORT === 'true',
  },
  reactCompiler: true, // Enable React Compiler for automatic memoization
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
