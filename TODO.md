# TODO: Single Meme Public Sharing

## Context

**Approach**: Edge-optimized short links with lazy slug generation + three-tier caching
**Critical Fix**: Middleware slug resolution uses Memory → KV → DB caching to prevent database bottleneck
**Architecture Decision**: Deep modules for ShareService and ShareButton; inline shallow wrappers
**Key Patterns**:
- API routes: Follow `app/api/assets/[id]/route.ts` pattern (auth via `getAuth()`, ownership validation, JSON responses)
- Error responses: Standardized format with request IDs and user-friendly messages
- Caching: LRU memory cache → Vercel KV → Prisma fallback
- Components: shadcn/ui Button + Lucide icons + sonner toast

**Module Boundaries**:
1. **ShareService** (lib/share.ts): Deep module - hides nanoid, collision handling, retry logic
2. **SlugCache** (lib/slug-cache.ts): Three-tier caching for slug→ID resolution
3. **PublicMemeRoute** (app/m/[id]/page.tsx): Public viewing with OG metadata, inlined queries
4. **ShortLinkMiddleware** (middleware.ts): Transparent redirect using cached lookups
5. **ShareButton** (components/library/share-button.tsx): Self-contained share interface

---

## Phase 1: Database Schema

- [ ] Add shareSlug column to Asset model with index
  ```
  Files: prisma/schema.prisma:51
  Changes:
    - After deletedAt field (line 51), add:
      shareSlug String? @unique @map("share_slug") // Short ID for public sharing URLs
    - In indexes section (line 64), add:
      @@index([shareSlug])
  Migration: pnpm db:push (development) or pnpm db:migrate:dev --name add-share-slug (production)
  Success criteria: Schema validates, migration applies cleanly, shareSlug column is nullable and unique
  Why nullable: Lazy generation - only populated when user first shares
  Why unique: Each slug maps to exactly one asset
  Why indexed: Fast slug→ID lookups in middleware
  Estimated: 15min
  ```

---

## Phase 2: Share Link Generation API

- [ ] Install nanoid for short ID generation
  ```
  Command: pnpm add nanoid
  Verification: nanoid appears in package.json dependencies
  Version: Latest (currently 5.x)
  Why nanoid: URL-safe, collision-resistant (10^-12 probability at 1M IDs), faster than uuid
  Estimated: 2min
  ```

- [ ] Create standardized error response utility
  ```
  Files: lib/api-error.ts (new file)
  Purpose: Consistent error handling across all share endpoints
  Interface:
    export function apiError(code: ShareErrorCode, userMessage: string): NextResponse
    type ShareErrorCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'DELETED' | 'INTERNAL_ERROR'
  Implementation:
    - Generate request ID (crypto.randomUUID())
    - Map error code to HTTP status (NOT_FOUND→404, UNAUTHORIZED→401, etc)
    - Return JSON: { error: userMessage, code, requestId, timestamp }
    - Log server-side details without exposing in response
  Success criteria: All share endpoints use this for errors, no stack traces leak to clients
  Pattern reference: See app/api/assets/[id]/route.ts error handling but standardized
  Estimated: 20min
  ```

- [ ] Create share link generation service (deep module)
  ```
  Files: lib/share.ts (new file)
  Interface:
    export async function getOrCreateShareSlug(assetId: string): Promise<string>
  Implementation:
    1. Query asset.shareSlug where id = assetId
    2. If exists, return it (idempotency)
    3. If null, generate nanoid(10)
    4. Attempt prisma.asset.update({ where: { id: assetId }, data: { shareSlug } })
    5. On unique constraint violation (P2002), retry with new nanoid (max 3 attempts)
    6. Return slug
  Error handling:
    - Throw NotFoundError if asset doesn't exist
    - Throw CollisionError if 3 retries fail (log for investigation)
  Success criteria: Same assetId always returns same slug, handles collisions gracefully
  Why deep module: Hides nanoid choice, length (10), collision strategy, retry logic
  Testing: Unit test with mocked Prisma - verify idempotency, collision retry, error cases
  Estimated: 45min
  ```

- [ ] Create POST /api/assets/[id]/share endpoint
  ```
  Files: app/api/assets/[id]/share/route.ts (new file)
  Pattern: Follow app/api/assets/[id]/route.ts structure (lines 7-50)
  Implementation:
    1. Extract auth: const { userId } = await getAuth()
    2. Return 401 if !userId using apiError('UNAUTHORIZED', '...')
    3. Extract id from await params
    4. Query asset ownership: prisma.asset.findFirst({ where: { id, ownerUserId: userId, deletedAt: null }})
    5. Return 404 if !asset using apiError('NOT_FOUND', 'Asset not found')
    6. Call slug = await getOrCreateShareSlug(id)
    7. Build shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/s/${slug}`
    8. Return JSON: { shareUrl }
  Error handling: Use apiError() for all failures, catch and log unexpected errors
  Security: Must check ownerUserId AND deletedAt - soft-deleted assets not shareable
  Success criteria: Returns same URL on repeated calls, non-owners get 401, deleted assets get 404
  Environment variable: Ensure NEXT_PUBLIC_BASE_URL is set (fallback to request origin)
  Testing: API test verifying auth, ownership, idempotency, soft-delete filtering
  Estimated: 45min
  ```

---

## Phase 3: Public Meme Page

- [x] Create /m/[id] public page with metadata generation
  ```
  Files: app/m/[id]/page.tsx (new file)
  Pattern: Next.js 15 dynamic route with generateMetadata for OG tags
  Structure:
    1. export async function generateMetadata({ params })
    2. export default async function PublicMemePage({ params })

  generateMetadata() implementation:
    - Extract id from await params
    - Query directly (no wrapper):
      const asset = await prisma.asset.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, blobUrl: true, mime: true, width: true, height: true }
      })
    - If !asset, return { title: 'Meme not found' }
    - Return metadata object:
      {
        title: 'Check out this meme',
        description: 'Shared via Sploot',
        openGraph: {
          title: 'Check out this meme',
          description: 'Shared via Sploot',
          images: [{ url: asset.blobUrl, width: asset.width, height: asset.height, alt: 'Meme' }],
          siteName: 'Sploot',
          type: 'website'
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Check out this meme',
          description: 'Shared via Sploot',
          images: [asset.blobUrl]
        }
      }

  Page component implementation:
    - Same query as generateMetadata (Next.js caches this)
    - If !asset, return 404 page with "Meme not found" + link to homepage
    - Render: centered image on black background
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <Image src={asset.blobUrl} alt="Shared meme" className="max-w-full max-h-[90vh] object-contain" />
        <footer className="mt-8 text-sm text-gray-500">
          <a href="/">Shared via Sploot</a>
        </footer>
      </div>

  Why inline query: getPublicAsset would be shallow wrapper (per ultrathink)
  Security: deletedAt filter prevents viewing soft-deleted assets
  Performance: OG crawlers and page both use same query (Next.js request caching)
  Success criteria: OG tags validate with og-image-validator, soft-deleted returns 404, responsive on mobile
  Testing: Unit test for generateMetadata output structure, E2E test for page render
  Estimated: 1.5h
  ```

---

## Phase 4: Slug Resolution Caching & Redirect

- [x] Create three-tier slug resolution cache
  ```
  Files: lib/slug-cache.ts (new file)
  Purpose: Prevent middleware database bottleneck (critical per ultrathink)
  Dependencies: pnpm add @vercel/kv lru-cache

  Implementation:
    import { LRUCache } from 'lru-cache'
    import { kv } from '@vercel/kv'

    const slugCache = new LRUCache<string, string>({ max: 100, ttl: 300000 }) // 5min TTL

    export async function resolveShareSlug(slug: string): Promise<string | null> {
      // Tier 1: Memory (0ms)
      if (slugCache.has(slug)) {
        return slugCache.get(slug)!
      }

      // Tier 2: Vercel KV (~5-10ms)
      try {
        const kvResult = await kv.get<string>(`slug:${slug}`)
        if (kvResult) {
          slugCache.set(slug, kvResult)
          return kvResult
        }
      } catch (error) {
        // KV failure, fall through to DB
        console.warn('KV lookup failed:', error)
      }

      // Tier 3: Database (~20-50ms)
      const asset = await prisma.asset.findFirst({
        where: { shareSlug: slug, deletedAt: null },
        select: { id: true }
      })

      if (asset) {
        slugCache.set(slug, asset.id)
        try {
          await kv.set(`slug:${slug}`, asset.id, { ex: 86400 }) // 24h TTL
        } catch (error) {
          console.warn('KV write failed:', error)
        }
      }

      return asset?.id || null
    }

  Why three tiers: Memory (instant for repeated requests), KV (edge-cached for viral shares), DB (fallback)
  Why this matters: Without caching, 1000 concurrent share views = 1000 DB queries. With caching, <10 DB queries.
  Cache invalidation: When shareSlug updates (rare), clear both memory and KV
  Success criteria: DB queries <1% of total requests in production, <10ms p95 latency
  Testing: Unit test with mocked KV and Prisma, verify cache hit/miss behavior
  Estimated: 1h
  ```

- [ ] Extend middleware for short link redirects with caching
  ```
  Files: middleware.ts:1-33
  Changes:
    1. Import resolveShareSlug from lib/slug-cache.ts at top
    2. Import NextResponse from 'next/server'
    3. Add '/s(.*)', '/m(.*)' to isPublicRoute matcher (line 12-17)
    4. BEFORE clerkMiddleware call (before line 19), add redirect handler:

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

  Why before auth: Public routes shouldn't hit auth middleware
  Why 307: Temporary redirect allows changing behavior later (vs 301 permanent)
  Why inline lookup: getAssetIdByShareSlug would be shallow wrapper (per ultrathink)
  Query param preservation: Enables future analytics without breaking existing shares
  Success criteria: /s/validSlug redirects to /m/id in <50ms p95, invalid slugs return 404
  Testing: E2E test verifying redirect behavior, status codes, cache effectiveness
  Estimated: 30min
  ```

---

## Phase 5: Share Button UI

- [ ] Create ShareButton component
  ```
  Files: components/library/share-button.tsx (new file)
  Pattern: Follow components/ui/button.tsx and existing Lucide icon usage
  Dependencies: Already installed (lucide-react, sonner)

  Implementation:
    'use client'
    import { useState } from 'react'
    import { Share2 } from 'lucide-react'
    import { Button } from '@/components/ui/button'
    import { toast } from 'sonner'

    interface ShareButtonProps {
      assetId: string
      variant?: 'ghost' | 'default'
      size?: 'icon' | 'icon-sm'
    }

    export function ShareButton({ assetId, variant = 'ghost', size = 'icon-sm' }: ShareButtonProps) {
      const [loading, setLoading] = useState(false)

      const handleShare = async () => {
        setLoading(true)
        try {
          const res = await fetch(`/api/assets/${assetId}/share`, { method: 'POST' })
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to generate share link')
          }

          const { shareUrl } = await res.json()
          await navigator.clipboard.writeText(shareUrl)
          toast.success('Link copied! Share it with friends')
        } catch (error) {
          console.error('Share failed:', error)
          toast.error(error instanceof Error ? error.message : 'Failed to share')
        } finally {
          setLoading(false)
        }
      }

      return (
        <Button
          variant={variant}
          size={size}
          onClick={handleShare}
          disabled={loading}
          aria-label="Share meme"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      )
    }

  Why self-contained: No prop drilling, encapsulates all share logic
  Error handling: User-friendly messages, logs details for debugging
  Clipboard fallback: navigator.clipboard requires HTTPS (works on localhost and production)
  Success criteria: Clicking copies link and shows toast, errors display helpful messages, works on mobile Safari
  Testing: Component test with mocked fetch and clipboard API
  Estimated: 1h
  ```

- [ ] Integrate ShareButton into ImageTile hover actions
  ```
  Files: components/library/image-tile.tsx
  Location: Find existing hover action buttons (Heart, Trash2 around lines 200-300)
  Changes:
    1. Import: import { ShareButton } from './share-button'
    2. Add ShareButton alongside existing action buttons
    3. Pattern to follow: Look for Tooltip wrapper with Button containing Heart icon
    4. Add:
      <Tooltip>
        <TooltipTrigger asChild>
          <ShareButton assetId={asset.id} />
        </TooltipTrigger>
        <TooltipContent side="top">Share</TooltipContent>
      </Tooltip>

  Placement: Between favorite and delete buttons in hover actions container
  Visual consistency: Use same variant and size as other action buttons
  Success criteria: Share button appears on hover, functions correctly, matches existing UI style
  Testing: Visual test + integration test verifying button renders and API called on click
  Estimated: 20min
  ```

---

## Phase 6: Integration Testing

- [ ] Write comprehensive share flow integration test
  ```
  Files: __tests__/api/assets/share-flow.test.ts (new file)
  Pattern: Follow existing test structure in __tests__/api/
  Setup: Mock Clerk auth, Prisma, and fetch

  Test cases:
    describe('Share flow', () => {
      // Setup
      const mockUserId = 'user_123'
      const mockAssetId = 'asset_123'
      const mockSlug = 'aB3dF9Gh12'

      test('generates share link for asset owner', async () => {
        // Mock auth to return mockUserId
        // Mock Prisma to return asset with ownerUserId = mockUserId
        // POST /api/assets/{mockAssetId}/share
        // Expect 200, shareUrl contains slug
      })

      test('returns same URL on repeated shares (idempotency)', async () => {
        // First share generates slug
        // Second share returns same slug
        // Verify both URLs identical
      })

      test('rejects non-owner share attempts', async () => {
        // Mock auth to return different userId
        // POST /api/assets/{mockAssetId}/share
        // Expect 401
      })

      test('rejects sharing soft-deleted assets', async () => {
        // Mock Prisma to return asset with deletedAt set
        // POST /api/assets/{mockAssetId}/share
        // Expect 404
      })

      test('redirects short link to canonical URL', async () => {
        // Mock resolveShareSlug to return mockAssetId
        // GET /s/{mockSlug}
        // Expect 307 redirect to /m/{mockAssetId}
      })

      test('returns 404 for invalid short links', async () => {
        // Mock resolveShareSlug to return null
        // GET /s/invalid
        // Expect 404
      })

      test('public page renders for valid asset', async () => {
        // Mock Prisma to return public asset fields
        // GET /m/{mockAssetId}
        // Expect 200, OG tags present
      })

      test('public page returns 404 for soft-deleted', async () => {
        // Mock Prisma to return null (deletedAt filtered)
        // GET /m/{mockAssetId}
        // Expect 404
      })
    })

  Success criteria: All tests pass, 100% coverage of share logic, mocks properly isolated
  Coverage targets: share.ts (100%), share API route (100%), middleware redirect (90%)
  Estimated: 1.5h
  ```

- [ ] Add automated OG metadata validation test
  ```
  Files: __tests__/app/m/metadata.test.ts (new file)
  Purpose: Verify OG tags without manual social debugger testing
  Pattern: Test Next.js generateMetadata function directly

  Implementation:
    import { generateMetadata } from '@/app/m/[id]/page'

    describe('Public meme page metadata', () => {
      test('generates valid OG tags for existing asset', async () => {
        // Mock Prisma to return test asset
        const metadata = await generateMetadata({
          params: Promise.resolve({ id: 'test-asset-id' })
        })

        // Validate structure
        expect(metadata.openGraph.title).toBe('Check out this meme')
        expect(metadata.openGraph.description).toBe('Shared via Sploot')
        expect(metadata.openGraph.images[0].url).toMatch(/^https:\/\//)
        expect(metadata.openGraph.images[0].url).toContain('.vercel-storage.com')
        expect(metadata.openGraph.siteName).toBe('Sploot')

        // Validate Twitter Card
        expect(metadata.twitter.card).toBe('summary_large_image')
        expect(metadata.twitter.images[0]).toBe(metadata.openGraph.images[0].url)
      })

      test('returns 404 metadata for non-existent asset', async () => {
        // Mock Prisma to return null
        const metadata = await generateMetadata({
          params: Promise.resolve({ id: 'invalid-id' })
        })

        expect(metadata.title).toBe('Meme not found')
        expect(metadata.openGraph).toBeUndefined()
      })

      test('returns 404 metadata for soft-deleted asset', async () => {
        // Mock Prisma query filters deletedAt, returns null
        const metadata = await generateMetadata({
          params: Promise.resolve({ id: 'deleted-asset' })
        })

        expect(metadata.title).toBe('Meme not found')
      })
    })

  Why automated: Fast feedback, runs in CI, no manual social debugger needed
  Success criteria: Tests pass, validates OG structure matches spec
  Estimated: 30min
  ```

---

## Success Criteria Summary

Implementation complete when:
- [x] shareSlug column added to Asset model with unique index
- [ ] Share API endpoint returns consistent URLs for same asset
- [ ] Non-owners receive 401 when attempting to share
- [ ] Soft-deleted assets return 404 on all public routes
- [ ] Short links (/s/*) redirect to public pages (/m/*) in <50ms p95
- [ ] Invalid short links return 404
- [ ] Public meme pages render without auth requirement
- [ ] OG metadata validates correctly (automated test)
- [ ] Share button appears on image tiles and copies link
- [ ] Toast notifications confirm successful sharing
- [ ] Three-tier caching reduces DB queries to <1% of traffic
- [ ] All integration tests pass
- [ ] Type checking clean (pnpm type-check)
- [ ] Build succeeds (pnpm build)

---

**Estimated Total Time**: 9-10 hours

**Critical Path**: Phase 1 → Phase 2 → Phase 4 → Phase 5

**Parallel Opportunities**: Phase 3 can start after Phase 1 completes
