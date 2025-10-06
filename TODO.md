# TODO: Fix Vercel Build - Remove Dead Code

**Root Cause**: `/offline` page fails to prerender because root layout wraps all routes with `ClerkProvider`, which requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` during static generation. Preview deployments lack Clerk env vars, causing build failures.

**Solution**: Delete unused `/offline` page (dead code - never wired to service worker) and add Clerk env vars to Preview environment.

---

## Tasks

- [ ] Delete `app/offline/page.tsx`
  - Page is dead code - never wired to service worker or PWA manifest
  - Actual offline functionality works via: service worker image caching, background sync, `OfflineProvider`
  - ADR proposed it but implementation never completed
  - Success criteria: File deleted, git history shows removal
  ```bash
  git rm app/offline/page.tsx
  ```

- [ ] Remove `/offline` reference from `middleware.ts`
  - Remove `/offline` from `isPublicRoute` array (no longer exists)
  - Cleanup: route is gone, middleware shouldn't reference it
  - Success criteria: No references to `/offline` in middleware config
  ```tsx
  // In middleware.ts, isPublicRoute should be:
  const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/health'
  ])
  ```

- [ ] Add Clerk environment variables to Vercel Preview environment
  - Required for Preview deployments to test auth flows
  - Currently scoped to Production only (added 3 days ago)
  - Success criteria: `vercel env ls preview` shows all Clerk vars
  ```bash
  # Copy values from Production environment (same values)
  vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview
  vercel env add CLERK_SECRET_KEY preview
  vercel env add NEXT_PUBLIC_CLERK_SIGN_IN_URL preview
  vercel env add NEXT_PUBLIC_CLERK_SIGN_UP_URL preview
  vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL preview
  vercel env add NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL preview
  ```
  - Note: Use same values as Production (check `.env.example` or Vercel dashboard)
  - This ensures Preview deployments can properly test auth flows

- [ ] Verify Vercel build succeeds
  - Commit changes and push to trigger Preview deployment
  - Success criteria: Build passes without prerender errors
  - Success criteria: Preview deployment accessible and functional
  - Monitor: https://vercel.com/moomooskycow/sploot deployment logs

---

## Why This Approach

**Dead Code Evidence:**
- Service worker (`sw-custom.js`) doesn't route to `/offline`
- PWA manifest has no offline fallback configured
- `next.config.ts` PWA setup has no `offlinePage` option
- ADR-005 mentions it but never implemented
- Actual offline features work via different mechanisms:
  - Image caching: `CacheFirst` for Vercel Blob URLs (500 max, 30 days)
  - Upload retry: Background sync via service worker
  - Connection state: `OfflineProvider` component

**Simplicity:**
- 3 tasks vs 9 tasks (route group refactoring)
- Removes technical debt instead of working around it
- ~5 minutes vs ~20 minutes

**Correct Fix:**
- Dead code should be deleted, not preserved
- Preview environment should have proper auth config
- Clean, minimal change with maximum impact
