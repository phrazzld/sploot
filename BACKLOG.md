# BACKLOG

Last groomed: 2025-10-22
Analyzed by: 7 specialized perspectives (complexity, architecture, security, performance, maintainability, UX, product)

---

## Future Enhancements: Public Sharing

### Keyboard Shortcut for Share

**Description**: Add Cmd/Ctrl + Shift + S keyboard shortcut to share focused meme

**Value**: Power user convenience, faster workflow for frequent sharers

**Complexity**: Medium-High
- Requires focus management state (which meme is "selected")
- Browser keyboard handling varies
- Must work across different view modes (grid, list)
- Integration with existing keyboard shortcuts (search, command palette)

**Estimated Effort**: 45min-1h implementation + testing

**Decision Rationale**: Deferred from MVP per ultrathink review
- Adds focus management complexity with unclear ROI
- Share button on hover is sufficient for most users
- Should validate demand with user feedback before building
- Focus management is hard to get right across browsers/devices

**Implementation Notes** (when prioritized):
```typescript
// Needs:
// 1. Focus/selection state in FilterContext or new FocusContext
// 2. useKeyboardShortcut hook integration
// 3. Visual focus indicator on selected tile
// 4. Keyboard navigation between tiles (arrow keys)

useKeyboardShortcut({
  key: 's',
  metaKey: true,
  shiftKey: true,
  onTrigger: () => {
    if (focusedAssetId) {
      handleShare(focusedAssetId)
    }
  }
})
```

**Success Metrics** (when built):
- Shortcut works in grid and list views
- Visual indicator shows which meme is focused
- Works on Mac (Cmd) and Windows/Linux (Ctrl)
- Doesn't conflict with browser shortcuts

---

### Manual OG Tag Testing Checklist

**Description**: Manual validation of link previews on actual social platforms

**Platforms**:
- iMessage (iOS/macOS)
- WhatsApp (iOS/Android)
- Twitter/X
- Facebook
- Discord
- Slack

**Process**:
1. Deploy to Vercel preview environment
2. Share test link in each platform
3. Verify image displays correctly
4. Verify title and description appear
5. Test on both mobile and desktop

**Tools**:
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

**Timing**: After automated OG tests pass, before production release

**Estimated Effort**: 30-45min per full platform sweep

**Why Deferred**:
- Automated OG structure tests catch 90% of issues
- Manual testing is slow and hard to CI
- Can validate in staging before each release
- Platform-specific issues are rare with standard OG tags

---

### Mobile Device Testing

**Description**: Comprehensive mobile-specific UX validation

**Test Cases**:
- [ ] Share button touch target adequate (min 44x44px)
- [ ] Clipboard API works on iOS Safari
- [ ] Clipboard API works on Chrome Android
- [ ] Toast notifications visible and dismissible
- [ ] Public page responsive on small screens (320px width)
- [ ] Public page responsive on large phones (414px width)
- [ ] Public page responsive on tablets (768px width)
- [ ] Link preview loads correctly in iMessage
- [ ] Link preview loads correctly in WhatsApp
- [ ] No HTTPS errors on clipboard access

**Devices to Test**:
- iPhone (Safari)
- Android phone (Chrome)
- iPad (Safari)

**Estimated Effort**: 30-45min per full device sweep

**Why Deferred**:
- Component works in browser dev tools mobile simulation
- Clipboard API is standard across modern mobile browsers
- Can validate in beta with real users before full launch
- Desktop testing covers core functionality

---

### Share Analytics & View Tracking

**Description**: Track share link views, click-through rates, and conversion to signup

**Metrics to Track**:
- Share link generations per day
- Unique views per shared meme
- Geographic distribution of viewers
- Referrer sources (iMessage, Twitter, Discord, etc.)
- Click-through to signup page
- Share-to-signup conversion rate

**Implementation**:
```typescript
// Add to /m/[id]/page.tsx
await logShareView({
  assetId: id,
  viewerIp: req.ip,
  referrer: req.headers.referer,
  userAgent: req.headers['user-agent']
})

// New table: share_views
model ShareView {
  id        String   @id @default(cuid())
  assetId   String
  viewedAt  DateTime @default(now())
  viewerIp  String   // Hashed for privacy
  referrer  String?
  userAgent String?

  @@index([assetId, viewedAt])
}
```

**Value**:
- Understand viral potential
- Measure feature success
- Identify popular share sources
- Optimize for conversion

**Estimated Effort**: 3-4h (database, API, analytics dashboard)

**Why Deferred**:
- MVP doesn't need analytics to function
- Should validate feature works before adding instrumentation
- Analytics can be added retroactively
- Adds database writes to public route (performance consideration)

**Privacy Considerations**:
- Hash IP addresses before storage
- Aggregate data after 30 days (delete raw logs)
- No PII collection
- Comply with GDPR/CCPA

---

### Rate Limiting for Public Routes

**Description**: Implement per-IP rate limiting on /s/* and /m/* routes

**Current**: No rate limiting on public routes

**Proposal**:
```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { kv } from '@vercel/kv'

export const publicRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(100, '1m'), // 100 requests per minute
  analytics: true
})

// In middleware.ts
if (req.nextUrl.pathname.startsWith('/s/') || req.nextUrl.pathname.startsWith('/m/')) {
  const ip = req.ip ?? '127.0.0.1'
  const { success } = await publicRateLimit.limit(ip)
  if (!success) {
    return new NextResponse('Too many requests', { status: 429 })
  }
}
```

**Limits**:
- 100 requests per minute per IP
- 1000 requests per hour per IP
- Whitelist Vercel's crawler IPs
- More lenient for OG crawlers (Facebook, Twitter bots)

**Value**:
- Prevent scraping
- Protect against DDoS
- Reduce abuse

**Estimated Effort**: 2-3h (implementation, testing, monitoring)

**Why Deferred**:
- Not critical for MVP
- Vercel has DDoS protection at edge
- Can monitor traffic and add if abuse detected
- Want to see real traffic patterns before setting limits

---

### Public Meme Collections (Phase 2 Feature)

**Description**: Allow users to create public collections of memes with shareable URLs

**Use Case**: "Check out my favorite reaction memes" or "Office humor collection"

**URL Structure**: `/c/[collectionSlug]` → grid view of memes in collection

**Features**:
- Create named collections
- Add multiple memes to collection
- Generate shareable collection URL
- Public collection page shows grid + collection name
- OG tags show collection preview (grid of 4 memes)

**Schema**:
```prisma
model Collection {
  id          String   @id @default(cuid())
  ownerUserId String
  name        String
  shareSlug   String?  @unique
  public      Boolean  @default(false)
  createdAt   DateTime @default(now())

  assets      CollectionAsset[]
}

model CollectionAsset {
  collectionId String
  assetId      String
  order        Int

  @@id([collectionId, assetId])
}
```

**Value**:
- Increases share virality (more memes per share)
- Differentiates from competitors
- Premium feature potential

**Estimated Effort**: 8-10h

**Why Deferred**: Phase 2 feature, single meme sharing must work first

---

### Share Link Expiration

**Description**: Optional TTL on share links (auto-expire after X days)

**Use Cases**:
- Temporary shares (event-specific memes)
- Privacy control (auto-delete after sharing)
- Storage cleanup (expire old unused shares)

**Implementation**:
```prisma
model Asset {
  // ...
  shareSlug      String?   @unique
  shareExpiresAt DateTime? // null = permanent
}
```

**UX**:
- Add "Expires in" dropdown when sharing (1 day, 7 days, 30 days, Never)
- Show expiration date on share confirmation toast
- Expired links show "This meme is no longer available" page

**Value**: User control over privacy, reduces storage costs

**Estimated Effort**: 3-4h

**Why Deferred**: Adds complexity to MVP, most users want permanent shares

---

### Share with Custom Message

**Description**: Allow users to add custom message when generating share link

**UX**:
```
[Share Button Clicked]
Modal opens:
  "Share this meme"
  Input: "Add a message (optional)"
  [Copy Link] [Cancel]
```

**Implementation**: Message stored in URL params → shown on public page

**Example**: `/m/abc123?msg=This%20is%20hilarious`

**Value**: More personal sharing, increases engagement

**Estimated Effort**: 2-3h

**Why Deferred**: Adds UX complexity, most shares don't need messages

---

## Now (Sprint-Ready, <2 weeks)

### [CRITICAL SECURITY] SQL Injection in Advanced Search
**File**: `app/api/search/advanced/route.ts:114-182`
**Perspectives**: security-sentinel
**Severity**: CRITICAL - Data exfiltration possible
**Attack Vector**: Unparameterized SQL with user-controlled `mimeTypes` and `dateFrom` filters
```typescript
// VULNERABLE: String interpolation
const mimeList = filters.mimeTypes.map((m: string) => `'${m}'`).join(',');
whereConditions.push(`a.mime IN (${mimeList})`);
// Attacker sends: ["image/jpeg') OR 1=1--"] → returns all assets
```
**Fix**: Use Prisma.sql tagged templates with parameterized values
**Effort**: 2h | **Risk Reduction**: CRITICAL
**Acceptance**: Malicious inputs rejected/escaped, no unauthorized data access

### [HIGH SECURITY] IDOR in Asset Update Endpoint
**File**: `app/api/assets/[id]/route.ts:106-119`
**Perspectives**: security-sentinel
**Impact**: Users can modify other users' asset metadata (favorites, tags)
**Issue**: Update operation uses only `id` without `ownerUserId` constraint
**Fix**: Add `ownerUserId: userId` to `prisma.asset.update({ where: { id, ownerUserId: userId } })`
**Effort**: 15m | **Risk Reduction**: HIGH
**Acceptance**: Cannot update assets owned by other users

### [PERFORMANCE] N+1 Queries in Search Results
**File**: `app/api/search/route.ts:150-180`
**Perspectives**: performance-pathfinder
**Impact**: 500-800ms added latency per search
**Issue**: Fetches tags individually for each search result (30 results = 31 queries)
**Fix**: Batch fetch all tags in single query, build Map for O(1) lookups
```typescript
const assetIds = searchResults.map(r => r.id);
const allTags = await prisma.assetTag.findMany({ where: { assetId: { in: assetIds } } });
// Build Map, then format results with lookups
```
**Effort**: 30m | **Impact**: 500-800ms → 50-100ms (5-8x improvement)
**Acceptance**: Search response time <200ms for 30 results

### [PERFORMANCE] Over-Fetching Embedding Vectors
**File**: `app/api/assets/route.ts:227-245`
**Perspectives**: performance-pathfinder
**Impact**: 200-400ms added latency + 300KB unnecessary data transfer
**Issue**: Includes full embedding vectors (768 floats × 100 assets = ~300KB) when only status needed
**Fix**: Selective include - fetch only embedding metadata, not vector data
```typescript
include: {
  embedding: {
    select: { status: true, completedAt: true } // Omit imageEmbedding vector
  }
}
```
**Effort**: 15m | **Impact**: 300KB → 20KB payload, 200-400ms → 50ms
**Acceptance**: Asset list loads <300ms with 100 assets

### [ARCHITECTURE] Consolidate Duplicate Cache Implementations
**Files**: `lib/cache.ts` (291 lines) + `lib/multi-layer-cache.ts` (373 lines)
**Perspectives**: complexity-archaeologist, architecture-guardian
**Issue**: Two nearly identical cache implementations with different interfaces
- Both use LRUCache with same TTLs
- Different status enums, different storage formats
- Developers confused which to use
**Fix**: Delete `lib/cache.ts`, rename `MultiLayerCache` → `CacheService`, unify interface
**Effort**: 3h | **Impact**: HIGH - Single source of truth, -291 duplicate lines
**Acceptance**: All cache operations use single implementation, tests pass

### [MAINTAINABILITY] Standardize API Error Responses
**Files**: `app/api/**/route.ts` (24 routes)
**Perspectives**: maintainability-maven, user-experience-advocate
**Issue**: 3 different error handling patterns across API routes
- Pattern A: Inline NextResponse.json
- Pattern B: Try-catch with unstable_rethrow
- Pattern C: createErrorResponse (exists but unused)
**Fix**: Centralize on `lib/api-response.ts` with `apiError()` helper
```typescript
return apiError('No file provided', {
  status: 400,
  userMessage: 'Please select a file'
});
```
**Effort**: 3h | **Impact**: HIGH - Uniform error handling, better UX
**Acceptance**: All API routes use standardized error responses with requestId

---

## Next (This Quarter, <3 months)

### [ARCHITECTURE] Split God Object: lib/db.ts
**File**: `lib/db.ts:1-560` (16 exported functions, 7 distinct domains)
**Perspectives**: complexity-archaeologist, architecture-guardian
**Issue**: Single file mixing client init + user mgmt + assets + embeddings + vector search + analytics
**Approach**: Extract to focused repositories
```
lib/repositories/
  UserRepository.ts - user CRUD + sync
  AssetRepository.ts - asset CRUD + pagination
  EmbeddingRepository.ts - embeddings + vector search
  SearchAnalyticsRepository.ts - search logging
```
**Effort**: 12h | **Impact**: HIGH - Enables testing, clear boundaries
**Dependencies**: None
**Acceptance**: Business logic testable without database, schema changes isolated

### [PERFORMANCE] Add Missing Database Index
**File**: `app/api/search/route.ts:264-269`
**Perspectives**: performance-pathfinder
**Issue**: DISTINCT on `query` column without covering index → sequential scan
**Impact**: 100-300ms for users with 1000+ searches
**Migration**:
```sql
CREATE INDEX idx_search_logs_user_query_recent
ON search_logs(user_id, query, "createdAt" DESC)
WHERE "createdAt" > NOW() - INTERVAL '30 days';
```
**Effort**: 10m | **Impact**: 100-300ms → 5-10ms (10-30x improvement)

### [ARCHITECTURE] Decompose Upload Route Monolith
**File**: `app/api/upload/route.ts:39-648` (523 lines, 10 responsibilities)
**Perspectives**: complexity-archaeologist, architecture-guardian
**Issue**: Single POST handler mixing validation, processing, deduplication, blob storage, DB, tags, embeddings, cleanup
**Approach**: Extract focused services
```
lib/services/
  UploadValidator - file validation + duplicate detection
  ImageProcessor - image processing + checksums
  AssetPersister - DB transactions + rollback
```
**Effort**: 10h | **Impact**: HIGH - Testability, eliminates change amplification
**Acceptance**: Route reduced from 523 → <100 lines, services unit tested

### [PRODUCT] Collections & Folders
**Perspectives**: product-visionary, user-experience-advocate
**Business Case**: Removes scale ceiling at 100+ memes, unlocks power users (20% of users, 80% engagement)
**Features**:
- Create/edit/delete collections
- Nest collections (hierarchical structure)
- Drag-drop assets to collections
- Collection-based views and filters
**Schema**:
```typescript
model Collection {
  id String @id
  userId String
  name String
  parentId String? // Nesting
  assets CollectionAsset[]
}
```
**Effort**: 15h | **Value**: HIGH - Premium tier feature, power user retention
**Acceptance**: Users can organize 500+ memes in nested collections

### [UX] Embedding Generation Failure Notifications
**File**: `app/api/upload/route.ts:614-647`
**Perspectives**: user-experience-advocate
**Issue**: Silent embedding failures → users don't know images aren't searchable
**Fix**: Surface embedding status in UI
- Toast notification on failure: "Upload complete, but search indexing failed for 2 images. [Retry]"
- Visual indicator on image tiles (status badge)
- Bulk retry action
**Effort**: 3h | **Value**: HIGH - Critical for search functionality
**Acceptance**: Users notified of embedding failures within 10s, can retry from UI

### [TEST] Add Tests for Critical Business Logic
**Files**: `app/api/upload/route.ts`, `app/api/search/route.ts`, `lib/db.ts`
**Perspectives**: maintainability-maven
**Gap**: Only 15% file coverage, zero tests for upload/search/database
**Critical Paths**:
```typescript
// Upload: Duplicate handling, blob cleanup on DB failure, race conditions
describe('POST /api/upload', () => {
  it('should cleanup blob when DB insert fails with P2002')
  it('should handle simultaneous uploads of same file')
});

// Search: Vector similarity, threshold fallback, cache integration
describe('vectorSearch', () => {
  it('should prevent SQL injection via embedding array')
  it('should apply threshold filter correctly')
});
```
**Effort**: 12h | **Impact**: HIGH - Prevent regressions, enable refactoring
**Acceptance**: 70%+ coverage for upload, search, DB layer

---

## Soon (Exploring, 3-6 months)

### [PRODUCT] OCR & Text Extraction
**Perspectives**: product-visionary
**Business Case**: Solves 50% missing meme context (text overlays), differentiation opportunity
**Features**:
- Extract text from memes using Tesseract.js (MVP) or Vision API (premium)
- Hybrid search: semantic + full-text matching
- Auto-suggest tags from extracted text
**Schema**: Add `extractedText`, `ocrConfidence`, `ocrProcessedAt` to Asset model
**Effort**: 18h
**Strategic Value**: HIGH - "AI that actually gets memes", premium justification

### [PRODUCT] Freemium Model & Stripe Integration
**Perspectives**: product-visionary
**Tiers**:
- **Free**: 500 memes, basic search, tags (up to 20), Sploot watermark on shares
- **Pro** ($8/mo): Unlimited memes, advanced search, collections, premium OCR, analytics, 10GB storage
- **Team** ($15/user/mo): Shared workspaces, permissions, SSO, 100GB storage, API access
**Implementation**: Stripe checkout, webhooks, tier enforcement middleware, billing page
**Effort**: 30h
**Strategic Value**: CRITICAL - Sustainable business model, validates product-market fit

### [ARCHITECTURE] Introduce Service Layer
**Perspectives**: architecture-guardian
**Issue**: API routes directly access Prisma → tight coupling, no business logic layer
**Approach**: Create service layer between API and database
```
lib/services/
  AssetService - asset business logic
  SearchService - search + caching + analytics
  EmbeddingService - embedding orchestration
```
**Effort**: 16h
**Impact**: HIGH - Testability, proper layering, maintainability

### [PRODUCT] Batch Operations & Multi-Select
**Perspectives**: product-visionary, user-experience-advocate
**Features**:
- Select multiple memes (checkbox mode)
- Bulk delete (with confirmation)
- Bulk tag/untag
- Bulk add to collection
- Bulk favorite/unfavorite
**API**: `POST /api/assets/batch { assetIds, action, params }`
**Effort**: 10h
**Value**: MEDIUM-HIGH - Power user retention, premium feature gate

---

## Later (Someday/Maybe, 6+ months)

### [PRODUCT] Team Workspaces & Collaboration
**Business Case**: Opens B2B market (10x ARPU), team tier at $15/user/mo vs $8 individual, lower churn
**Features**: Shared collections, RBAC, invitations, team billing, activity feed
**Effort**: 40h

### [PRODUCT] Native Mobile App (iOS/Android)
**Business Case**: App Store discovery (30-50% growth), 2x engagement vs PWA, native features (share sheet, camera, push notifications)
**Approach**: React Native (70% code reuse with web)
**Effort**: 80h

### [PRODUCT] Public API & Webhooks
**Features**: REST API for assets/search/collections, webhook events, API keys, rate limiting, developer docs
**Business Case**: Ecosystem growth, enterprise requirement, pro/team tier only
**Effort**: 25h

### [INNOVATION] AI Auto-Tagging
**Features**: Suggest tags based on CLIP embeddings + OCR text, learn from accept/reject patterns
**Business Case**: Reduces organization friction, premium feature
**Effort**: 25h

### [INNOVATION] Meme Generation
**Features**: Template library (Drake, Distracted Boyfriend), text overlay generation, DALL-E integration
**Business Case**: Unique differentiator, viral potential
**Effort**: 40h

---

## Learnings

**From this grooming session:**

### Security
- **SQL injection found in advanced search** - Reminder to always use parameterized queries, even with Prisma raw SQL
- **IDOR in update endpoint** - Auth check insufficient; must include ownership in WHERE clause of updates
- **No rate limiting yet** - Defense-in-depth: auth alone not enough, need per-user/per-IP limits

### Performance
- **N+1 queries in search** - Common pattern: always batch-fetch related data after primary query
- **Over-fetching embeddings** - Prisma includes should be selective; vectors are expensive to transfer
- **Client-side sorting** - Database is 20-40x faster than JavaScript for sorting 1000+ items

### Architecture
- **Duplicate cache implementations** - Tactical debt from evolution; should consolidate when adding second implementation
- **God object (db.ts)** - Started small, grew to 560 lines; split at 300-line threshold
- **Missing service layer** - API routes coupled to database; refactor needed before scaling

### Product
- **Zero monetization infrastructure** - Brilliant tech, no business model; need freemium + Stripe
- **No sharing features** - Private-only = no viral growth; biggest missing piece
- **Single-user only** - B2B market 10x larger than B2C; team features = strategic priority

### User Experience
- **Silent failures** - Embedding errors not surfaced to users; every background job needs status UI
- **Missing loading states** - Users anxious during long operations; show progress, not just spinners
- **Poor error messages** - Technical jargon exposed to end users; need user-facing copy vs admin messaging

### Maintainability
- **15% test coverage** - Critical paths (upload, search, DB) untested; regressions ship to production
- **3 error handling patterns** - Inconsistency slows development; standardize early
- **Magic numbers undocumented** - Cache sizes, TTLs lack rationale; blocks informed tuning

---

## Rejected Ideas

**Why not included:**

- **Progressive enhancement without JS** - React SPA fundamentally requires JavaScript; doesn't align with architecture
- **Feature flags for UI changes** - Not going to production; unnecessary complexity for feature branch
- **Encrypt localStorage preferences** - Non-sensitive UI state; encryption overhead unjustified
- **Split large PR** - Cohesive refactor; splitting creates broken intermediate states
- **CSS-only hover states** - Current JS approach works fine; premature optimization
- **Intersection Observer for virtual scroll** - @tanstack/react-virtual already performant; micro-optimization

---

## Priority Summary

| Time Horizon | Focus | Est. Effort | Strategic Value |
|--------------|-------|-------------|-----------------|
| **Now** (0-2w) | Security fixes, performance quick wins, architecture foundation | 10h | Prevent vulnerabilities, 2-3x performance |
| **Next** (3mo) | Repository pattern, collections, testing, UX polish | 62h | Enable scaling, unlock power users |
| **Soon** (6mo) | Sharing, OCR, monetization, service layer | 86h | Viral growth, revenue, differentiation |
| **Later** (12mo+) | Teams, mobile, API, AI features | 210h+ | Platform expansion, B2B market |

**Total identified opportunities**: 28 items
**Estimated total effort**: 368+ hours
**Expected impact**: Security hardening + 5-8x performance + viral growth + monetization + market expansion

---

**Next grooming**: Q1 2026 or after shipping Next horizon items
