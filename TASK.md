# PRD — **Sploot** (Vercel-first meme library with text→image semantic search)

## 1) Summary & Goals

1. **Problem:** A fast, dead-simple way to store, browse, and **text-search** a personal collection of meme images/screenshots across devices.
2. **Solution:** A **Next.js (Vercel) PWA** with **Clerk** auth, **Vercel Blob** storage, **Vercel Postgres + `pgvector`** search, and **CLIP/SigLIP** cross-modal embeddings (text→image).
3. **Primary goals (v1):**

   * Private library, single user (owner) to start.
   * Lightning-fast **text search** over images (no OCR).
   * Seamless upload (drag-drop/paste), browse grid, favorites, optional tags.
   * Keep ops minimal: “as much in Vercel as possible”.

---

## 2) Scope (v1) & Non-Goals

1. **In scope (v1):**

   * Clerk auth (Google/Apple + magic link).
   * Upload images to **Vercel Blob**; capture minimal metadata (mime, width/height, checksum).
   * Inline **image embeddings** at ingest (hosted inference); **text embeddings** at query time.
   * Search endpoint using **`pgvector` HNSW** over image vectors; filter by owner.
   * PWA: installable shell, responsive grid, text search bar, favorites; optional user tags.
2. **Non-goals (v1):**

   * OCR/captions, multi-tenant orgs, complex sharing/ACL.
   * Native apps, video/GIF animation semantics, edit tools.
   * Re-ranking with heavy cross-encoders, dedup UI beyond simple hash/pHash checks.

---

## 3) Assumptions & Constraints

1. **Stack:** Vercel (Next.js App Router), Clerk, Vercel Blob, Vercel Postgres (Neon) + `pgvector`.
2. **Embeddings:** Hosted inference for CLIP/SigLIP (managed endpoint). No self-hosted GPU.
3. **Content:** Images only (jpg/png/webp/gif static). No videos for v1.
4. **Scale (initial):** Single user; low QPS; ≤ hundreds of thousands of images is plenty.
5. **Privacy:** Library is private by default; no public links v1.

---

## 4) Success Metrics (v1)

1. **TTV (time-to-value):** < 90s from sign-in to first successful upload.
2. **Upload UX:** p95 “upload→visible in grid” < 2.5s (includes inline embedding & metadata write).
3. **Search latency:** p95 text query → first results < 500ms (DB KNN + join, excluding cold embed).
4. **Relevance:** At least one correct/expected meme appears top-10 in 80% of test prompts.
5. **Reliability:** Error rate < 0.5% for uploads & searches over a week of normal usage.

---

## 5) Core User Stories

1. As a user, I can **drag-drop/paste** an image and see it appear in my grid quickly.
2. As a user, I can type a **text prompt** (“distracted boyfriend”, “drake yes/no”) and see relevant images.
3. As a user, I can **favorite** images and filter/sort by favorites or recency.
4. As a user, I can **tag** images (optional) and filter by tags.
5. As a user, I remain **signed in** across devices (Clerk sessions) and can install the app as a PWA.

---

## 6) UX & IA (Information Architecture)

1. **Pages/Routes**

   * `/sign-in` (Clerk hosted components).
   * `/app` (default grid): search bar at top, masonry image grid, “Upload” CTA, filters (All/Favorites/Tags).
   * `/app/upload` (modal or inline area): drag-drop/paste + file picker.
   * `/app/settings` (minimal): model/version info, storage stats.
2. **Key Interactions**

   * **Upload:** drag-drop or paste → progress → appears in grid (with optimistic tile).
   * **Search:** single text field; live submit on Enter (no OCR, no advanced filters at v1).
   * **Tile actions:** favorite ★, quick tag, delete (soft-delete).
3. **PWA**

   * Install prompt, offline UI shell, resume **pending uploads** if connection drops.

---

## 7) System Architecture (High-Level)

1. **Client (Next.js PWA)**

   * Uses Clerk for session, calls server routes for upload/search.
   * Uses Next/Image for remote display/transforms.
2. **Server (Next.js Route Handlers)**

   * Auth middleware via Clerk.
   * Signed upload URLs for **Vercel Blob**.
   * Finalize asset → compute **checksum** (and optional **pHash**) → call **embedding endpoint** (image tower) → insert rows in Postgres (`assets`, `asset_embeddings`).
   * `/api/search` embeds **text** (text tower) and executes KNN on `pgvector`.
3. **Datastores**

   * **Vercel Blob:** raw image objects.
   * **Vercel Postgres + `pgvector`:** users, assets, embeddings, tags.

---

## 8) Data Model (minimal, extensible)

1. `users`

   * `id` (UUID, equals Clerk `userId`), `email`, `role`, `created_at`.
2. `assets`

   * `id` (UUID), `owner_user_id` (FK), `blob_url`, `mime`, `width`, `height`,
   * `checksum_sha256`, `phash` (nullable), `favorite` (bool, default false),
   * `created_at`, `deleted_at` (nullable).
3. `asset_embeddings`

   * `asset_id` (PK/FK), `model_name` (text), `dim` (int),
   * `image_embedding` (`vector`), `created_at`.
   * **Index:** HNSW on `image_embedding` (cosine).
4. *(Optional)* `tags`

   * `id`, `owner_user_id`, `name`, `created_at`.
5. *(Optional)* `asset_tags`

   * `asset_id`, `tag_id` (composite PK).

> Note: Avoid hardcoding `dim`; store it and validate per-model.

---

## 9) API Surface (v1)

1. `POST /api/upload-url`

   * **Auth:** required.
   * **Req:** `{ "filename": string, "mime": string }`
   * **Res:** `{ "url": string, "fields": object }` (Vercel Blob signed fields) or direct URL depending on Blob API.
2. `POST /api/assets`

   * **Auth:** required.
   * **Req:** `{ "blobUrl": string }`
   * **Flow:** server fetches head/metadata → computes `checksum_sha256` (+ optional `phash`) → calls **embeddings(image)** → inserts `assets` + `asset_embeddings`.
   * **Res:** `{ "asset": {id, blobUrl, width, height, favorite, created_at} }`
3. `POST /api/search`

   * **Auth:** required.
   * **Req:** `{ "query": string, "limit"?: number }`
   * **Flow:** **embeddings(text)** → KNN over `image_embedding` with `owner_user_id` filter → join `assets` → return sorted list.
   * **Res:** `{ "results": Array<{assetId, blobUrl, distance, favorite}> }`
4. `PATCH /api/assets/:id`

   * Toggle favorite or add/remove tags.
5. `DELETE /api/assets/:id`

   * Soft delete (`deleted_at`).

---

## 10) Embeddings & Search Design

1. **Model choice (default):** One of **SigLIP** or **CLIP** (both image & text towers).

   * v1 default: `model_name` stored; can swap via feature flag.
2. **Ingest (image tower):**

   * Run on every uploaded image.
   * Cache by `checksum_sha256` (avoid re-embedding duplicates).
3. **Query (text tower):**

   * Embed input text; short-TTL cache (e.g., 5–15 min) per unique query string.
4. **Indexing:**

   * `pgvector` **HNSW** with cosine distance.
   * Tunables: `m`, `ef_construction`, `ef_search` (runtime).
5. **Ranking:**

   * Sort by cosine distance; tie-break: favorites first, then recency.

---

## 11) Security & Privacy

1. Private by default. All list/read/write actions require Clerk session and ownership checks.
2. Uploads: token-scoped pre-signed URLs; server validates that `blobUrl` is owned by the caller.
3. No public sharing links in v1. No PII beyond auth email.
4. Audit logging for mutation endpoints (user id, asset id, action).

---

## 12) Performance Targets & SLOs

1. **Upload finalize (p95):** < 2.5s including embedding.
2. **Search (p95):** < 500ms for top-30 results (hot text-embed cache; KNN over ≤1M vectors).
3. **Cold start mitigation:** keep minimal serverless footprint; prefer edge-friendly route handlers where possible (embedding call remains serverful).

---

## 13) Observability & Analytics

1. **Metrics:**

   * Upload latency (network, finalize, embedding).
   * Search latency (embed + KNN), distances distribution.
   * Error rates per endpoint; Blob/DB failures.
2. **Logs:** Structured JSON; user id & request id correlation.
3. **Health:** Synthetic checks (upload small image nightly; canned search).
4. **Product analytics (light):** search queries (hashed), result clicks, favorites toggled.

---

## 14) Operations, Backups, Cost Control

1. **Backups:** Daily Postgres snapshots; periodic export of `assets` metadata. Blob is durable; optional lifecycle to cheaper storage (not required v1).
2. **Secrets/Config:** Clerk keys, Postgres URL, Blob token, Embedding endpoint key, `MODEL_NAME`, vector `dim`.
3. **Cost levers:** embedding cache, on-demand inference (pay per call), no thumbnails (Next/Image).

---

## 15) Risks & Mitigations

1. **Embedding latency spikes:** Cache results; support async retry on ingest if endpoint throttles (mark “pending embedding” state, show placeholder).
2. **`pgvector` performance at growth:** Tune HNSW; add read replica; plan migration to managed vector DB if >\~3–5M vectors or high QPS.
3. **Model drift / mismatch:** Store `model_name` and `dim`; block mixing vectors across models; provide backfill routine if swapping models.
4. **Duplicate clutter:** Use `checksum_sha256` to block exact dupes; optional `pHash` threshold for near-dupes.

---

## 16) Migration & Scalability Plan

1. **v1:** Single Postgres with `pgvector`; inline embedding; no queue.
2. **v1.1:** Add **Upstash/Redis queue** + background worker if ingest latency becomes noticeable.
3. **v2:** Dual-write to a dedicated vector DB (Qdrant/Weaviate) while keeping Postgres authoritative; backfill; cut over search; keep Postgres as fallback.

---

## 17) Test Plan & Acceptance Criteria

1. **Auth:** Sign-in flow works on desktop/mobile; session persists; protected routes reject anon.
2. **Upload:** Drag-drop/paste & picker both succeed; asset visible ≤2.5s; metadata accurate.
3. **Search:** 10 canonical prompts return expected memes in top-10 (manual gold set).
4. **Favorites:** Toggling reflects in sort/rank; filter “Favorites” works.
5. **PWA:** Install on iOS/Android/desktop; offline shell loads; pending uploads resume on reconnect.
6. **Perf:** Meets SLOs in staging with ≥5k assets.

---

## 18) Release Plan (milestones)

1. **M0 — Skeleton (1–2 days)**

   * Next.js app on Vercel; Clerk auth; `/app` gated route; PWA manifest.
2. **M1 — Upload (1–2 days)**

   * Vercel Blob integration; `/api/upload-url`, `/api/assets`; grid shows uploaded images.
3. **M2 — Embeddings & Search (2–3 days)**

   * Hosted embedding endpoint; `pgvector` schema/index; `/api/search` end-to-end; search bar UI.
4. **M3 — Polish (1–2 days)**

   * Favorites, basic tags, error toasts, loading states; minimal settings; metrics/logging.
5. **M4 — Hardening (1–2 days)**

   * Synthetic checks, backup policy, rate limits, perf tuning; relevance pass on gold prompts.

---

## 19) Appendix — Minimal Schema & Indices (illustrative)

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE assets (
  id uuid PRIMARY KEY,
  owner_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  blob_url text NOT NULL,
  mime text NOT NULL,
  width int,
  height int,
  checksum_sha256 text NOT NULL,
  phash text,
  favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Prevent exact dupes per user
CREATE UNIQUE INDEX assets_unique_user_checksum
  ON assets(owner_user_id, checksum_sha256) WHERE deleted_at IS NULL;

CREATE TABLE asset_embeddings (
  asset_id uuid PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  dim int NOT NULL,
  image_embedding vector NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- HNSW ANN index (parameters tuned later)
CREATE INDEX asset_embeddings_img_hnsw
  ON asset_embeddings USING hnsw (image_embedding vector_cosine_ops);
```

---

## 20) Open Items to Confirm (defaults proposed)

1. **Model default:** `SigLIP (384px)`; keep `CLIP ViT-L/14` as plan-B.
2. **Top-K default:** 60 (UI shows 30, infinite scroll loads more).
3. **Near-dupe handling:** block exact checksum dupes; show soft warning for pHash-similar.

> Approve the defaults above and we can move straight to route specs, minimal UI wireframes, and staging setup.

---

# Enhanced Specification

## Research Findings

### Industry Best Practices (2025)
- **SigLIP superiority**: 3-5% better recall than CLIP, performs better with smaller batches due to sigmoid loss function
- **Optimal embedding dimensions**: 512-768 dimensions balance accuracy and performance; SigLIP-Large-Patch16-384 recommended
- **pgvector HNSW tuning**: Use `m=24`, `ef_construction=128` for high-dimensional embeddings
- **Multi-layer caching**: Essential for cost optimization with external embedding APIs
- **PWA with Serwist/next-pwa**: Modern service worker implementation for offline capability

### Technology Analysis
Based on comprehensive research, the proposed stack aligns perfectly with 2025 best practices:
- **Next.js 15 with Turbopack**: 5x faster builds, React 19 support
- **Vercel ecosystem integration**: Optimal for serverless with 4.5MB function limit considerations
- **clerkMiddleware pattern**: New middleware approach with explicit route protection
- **Tailwind v4.0**: CSS-first configuration with native variable support

### Codebase Integration
As a greenfield project, Sploot should follow established Next.js patterns:
- App Router folder structure with route groups
- Server Components by default for optimal performance
- Edge-compatible middleware for auth
- Streaming with Suspense for progressive loading

## Detailed Requirements

### Functional Requirements
- **FR1: Image Upload**: Support drag-drop, paste, and file picker with formats: JPEG, PNG, WebP, GIF (static)
  - Acceptance: Upload completes in <2.5s p95 including embedding generation
- **FR2: Semantic Search**: Text queries return relevant images using cross-modal embeddings
  - Acceptance: <500ms p95 response time, 80% relevance in top-10 results
- **FR3: Favorites System**: Toggle favorite status on images with instant UI feedback
  - Acceptance: Optimistic updates with <100ms perceived latency
- **FR4: Tag Management**: Optional tagging with creation, assignment, and filtering
  - Acceptance: Tag operations complete in <200ms
- **FR5: PWA Installation**: Installable on all platforms with offline capability
  - Acceptance: Works offline for browsing, queues uploads for reconnection

### Non-Functional Requirements
- **Performance**:
  - Initial page load <1.5s
  - Image grid render <300ms for 100 images
  - Virtual scrolling for collections >1000 images
- **Security**:
  - All routes protected with Clerk authentication
  - Pre-signed URLs for blob access (5-minute expiration)
  - Content scanning for malware/NSFW (optional)
- **Scalability**:
  - Support up to 500k images per user
  - Handle 10 concurrent uploads
  - Maintain performance up to 5M vectors in pgvector
- **Availability**:
  - 99.5% uptime target
  - Graceful degradation when embedding service unavailable
  - Offline browsing with PWA

## Architecture Decisions

### Technology Stack (from ADRs)
- **Frontend**: Next.js 15 App Router with React 19, TypeScript 5+
- **Backend**: Next.js Route Handlers with edge compatibility where possible
- **Database**: Vercel Postgres with pgvector extension (HNSW indexing)
- **Storage**: Vercel Blob with pre-signed URLs for direct uploads
- **Authentication**: Clerk with new clerkMiddleware pattern
- **Embeddings**: Replicate API with SigLIP-Large-Patch16-384
- **Caching**: Multi-layer with Upstash Redis for embedding cache
- **PWA**: @ducanh2912/next-pwa with Serwist

### Design Patterns
- **Architecture Pattern**: Serverless-first with edge optimization
- **Data Flow**: Optimistic UI updates with eventual consistency
- **Upload Pattern**: Direct client upload to Blob, metadata-only server processing
- **Search Pattern**: Cached text embeddings, HNSW vector search
- **Caching Pattern**: Client → Edge → Redis → Database layers

### Key Architecture Decisions Summary
1. **ADR-001**: Use Replicate API for SigLIP embeddings (quality + simplicity)
2. **ADR-002**: pgvector for vectors <5M, migration path to dedicated DB later
3. **ADR-003**: Hybrid sync-async upload pipeline with optimistic UI
4. **ADR-004**: Multi-layer caching to optimize API costs
5. **ADR-005**: Network-first PWA with intelligent offline support

## Implementation Strategy

### Development Approach
Milestone-based development with progressive enhancement:
1. **M0**: Authentication and routing foundation
2. **M1**: Core upload functionality
3. **M2**: Search implementation
4. **M3**: Polish and PWA
5. **M4**: Performance optimization

### MVP Definition
1. Authenticated image upload with deduplication
2. Text-based semantic search with relevance ranking
3. Basic favorites system with filtering
4. PWA installation with offline browsing

### Technical Risks
- **Risk 1: Embedding latency spikes**
  → Mitigation: Aggressive caching, async retry, "pending" states
- **Risk 2: pgvector performance at scale**
  → Mitigation: HNSW tuning, read replicas, migration plan to Pinecone/Qdrant
- **Risk 3: Upload failures after blob storage**
  → Mitigation: Queue for retry, eventual consistency model
- **Risk 4: Model version mismatch**
  → Mitigation: Store model_name with embeddings, block mixing

## Integration Requirements

### Existing System Impact
N/A - Greenfield project

### API Design
```typescript
// Core API endpoints
POST /api/upload-url     // Get pre-signed blob URL
POST /api/assets         // Finalize upload with embeddings
POST /api/search         // Semantic search
PATCH /api/assets/:id    // Update favorites/tags
DELETE /api/assets/:id   // Soft delete

// Response formats
interface Asset {
  id: string
  blobUrl: string
  width: number
  height: number
  favorite: boolean
  tags?: string[]
  createdAt: Date
}

interface SearchResult {
  asset: Asset
  distance: number
  score: number
}
```

### Data Migration
Initial schema setup with pgvector:
```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optimized HNSW index
CREATE INDEX asset_embeddings_hnsw
  ON asset_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);
```

## Testing Strategy

### Unit Testing
- Components: React Testing Library with 80% coverage
- API routes: Mock Clerk auth and external services
- Utilities: Jest with 90% coverage for core functions
- Embedding cache: Test TTL, eviction, and hit rates

### Integration Testing
- Upload flow: Blob storage → embedding → database
- Search pipeline: Text embed → vector search → results
- Auth flow: Sign in → protected routes → session management
- PWA: Installation → offline → sync on reconnect

### End-to-End Testing
- Critical paths with Playwright:
  - Sign up → Upload → Search → View
  - Upload multiple → Search → Filter favorites
  - Install PWA → Go offline → Browse → Reconnect
- Performance testing: 5k images, measure SLOs

## Deployment Considerations

### Environment Requirements
```env
# Required environment variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
BLOB_READ_WRITE_TOKEN=
REPLICATE_API_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Rollout Strategy
1. **Preview deployments**: Auto-deploy PRs for testing
2. **Staging environment**: Full integration testing
3. **Production rollout**: Blue-green deployment via Vercel
4. **Feature flags**: Gradual rollout of new features
5. **Rollback plan**: Instant revert via Vercel

### Monitoring & Observability
- **Metrics**: Vercel Analytics + custom events
- **Error tracking**: Sentry integration
- **Performance**: Web Vitals monitoring
- **Logs**: Structured JSON with correlation IDs
- **Alerts**: Uptime monitoring, error rate thresholds

## Success Criteria

### Acceptance Criteria
- ✅ All functional requirements met with specified performance
- ✅ PWA installable on iOS, Android, and desktop
- ✅ Search relevance >80% for test query set
- ✅ Zero data loss during upload failures
- ✅ Graceful degradation when services unavailable

### Performance Metrics
- Upload latency p95 <2.5s
- Search latency p95 <500ms
- Initial load <1.5s
- Error rate <0.5%
- Uptime >99.5%

### User Experience Goals
- Time to first upload <90s
- Search satisfaction (correct result in top 10) >80%
- PWA installation rate >30% of active users
- Offline capability usage >20% of sessions

## Future Enhancements

### Post-MVP Features
1. **Batch operations**: Multi-select for bulk actions
2. **Advanced search**: Negative queries, date filters
3. **Smart suggestions**: Query completion, related searches
4. **Export/backup**: Download full library with metadata
5. **Sharing**: Generate temporary view links
6. **OCR search**: Text extraction from images
7. **GIF support**: Animated content with frame selection

### Scalability Roadmap
- **Phase 1** (0-100k images): Current architecture
- **Phase 2** (100k-1M): Add Redis caching layer, optimize queries
- **Phase 3** (1M-5M): Read replicas, connection pooling
- **Phase 4** (5M+): Migrate to dedicated vector DB (Pinecone/Qdrant)
- **Phase 5**: Multi-tenant support with organization

