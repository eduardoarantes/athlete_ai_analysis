import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/register', '/auth/callback', '/api/auth/callback', '/onboarding']

// Routes that start with these prefixes are public
const publicPrefixes = ['/api/auth/', '/api/webhooks/', '/api/workouts', '/_next/', '/favicon']

function isPublicRoute(pathname: string): boolean {
  // Normalize pathname by removing trailing slash (except for root)
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/$/, '')

  // Check exact matches
  if (publicRoutes.includes(normalizedPath)) {
    return true
  }

  // Check prefixes
  for (const prefix of publicPrefixes) {
    if (normalizedPath.startsWith(prefix)) {
      return true
    }
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Get Supabase config - try env vars first, then use hardcoded fallback for Amplify SSR
  // Note: In Amplify SSR middleware, we can't use getConfig() as it's not available
  // The NEXT_PUBLIC vars should be inlined at build time by Next.js
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase config is missing, redirect to home with error
    console.error('Supabase config missing in middleware')
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('error', 'config_missing')
    return NextResponse.redirect(redirectUrl)
  }

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login if not authenticated
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
