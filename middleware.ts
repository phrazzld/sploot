import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isMockMode } from './lib/env'

// Define protected routes that require authentication
const mockMode = isMockMode()

const isProtectedRoute = mockMode
  ? null
  : createRouteMatcher([
      '/app(.*)',
      '/api/upload-url(.*)',
      '/api/assets(.*)',
      '/api/search(.*)'
    ])

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health'
])

export default mockMode
  ? function middleware() {
      return NextResponse.next()
    }
  : clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute && isProtectedRoute(req)) {
        await auth.protect()
      }
    })

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
