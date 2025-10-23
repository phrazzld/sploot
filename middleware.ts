import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveShareSlug } from './lib/slug-cache'

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
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
  '/api/health',
  '/s(.*)',  // Short share links
  '/m(.*)'   // Public meme pages
])

export default clerkMiddleware(async (auth, req) => {
  // Handle short link redirects BEFORE auth
  if (req.nextUrl.pathname.startsWith('/s/')) {
    const slug = req.nextUrl.pathname.split('/')[2]
    if (!slug) {
      return new NextResponse('Not found', { status: 404 })
    }

    const assetId = await resolveShareSlug(slug)
    if (assetId) {
      const canonicalUrl = new URL(`/m/${assetId}`, req.url)
      // Preserve query params for future analytics
      canonicalUrl.search = req.nextUrl.search
      return NextResponse.redirect(canonicalUrl, 307) // Temporary redirect
    }

    return new NextResponse('Not found', { status: 404 })
  }

  if (isProtectedRoute(req)) {
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
