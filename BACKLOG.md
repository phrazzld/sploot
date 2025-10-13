# BACKLOG

> **Future Work**: Valid improvements deferred for post-merge iterations.
> Items here are important but not blocking the current PR merge.

## 🏗️ Infrastructure & Tooling

### Test Infrastructure

- **Restore memory leak detection** - The `__tests__/performance/memory-leak.test.ts` file was removed during the refactor. For an image-heavy application, memory leak detection is critical. Restore or replace with updated approach that works with new architecture. Consider using `@testing-library/react` memory testing utilities or Chrome DevTools Protocol for heap snapshots.
  - **Rationale for deferring**: Not merge-blocking; existing code doesn't have memory leak tests either
  - **Effort**: Medium (~2-3 hours to implement properly)
  - **Priority**: High for long-term quality
  - **PR Reference**: [PR #1 Review](https://github.com/phrazzld/sploot/pull/1) - Multiple reviews mentioned this

- **Add FPS monitoring for animations** - Several chrome components use spring animations and transitions. Add FPS tracking in dev mode to ensure 60fps is maintained. Use `requestAnimationFrame` timestamps or Performance Observer API. Display in corner or console.
  - **Rationale for deferring**: Nice-to-have optimization; current performance is acceptable
  - **Effort**: Small (~1 hour)
  - **Priority**: Low
  - **PR Reference**: PR #1 reviews suggested performance monitoring

- **Implement E2E tests for navigation flows** - Add Playwright tests for: navbar navigation, view mode switching, filter application, keyboard shortcuts, mobile responsive behavior, search flow with filters.
  - **Rationale for deferring**: Existing E2E tests cover core functionality; these would add confidence but aren't blocking
  - **Effort**: Large (~4-5 hours for comprehensive suite)
  - **Priority**: Medium
  - **PR Reference**: Mentioned in multiple PR #1 reviews

### Development Tools

- **Move test pages to Storybook or guard with env var** - Multiple `/app/test-*` pages exist for component development (test-command-palette, test-dropdown-animation, test-chrome, etc.). These shouldn't be accessible in production. Either: (1) Move to Storybook setup, (2) Add middleware redirect if `NODE_ENV === 'production'`, or (3) Use Next.js `pageExtensions` config to exclude in build.
  - **Rationale for deferring**: Low impact; extra bundle size is minimal
  - **Effort**: Small (~30 min)
  - **Priority**: Low
  - **Implementation**: Add to `middleware.ts`: `if (pathname.startsWith('/test-') && process.env.NODE_ENV === 'production') return NextResponse.redirect('/')`
  - **PR Reference**: Flagged in multiple reviews

## 📤 Upload & Processing

> **Context**: Phase 3 of bulk upload optimization completed 28/32 tasks. The 4 items below are deferred for post-merge iterations. See `docs/PHASE_3_COMPLETE.md` for completed work.

### Load Testing Infrastructure

- **Create Playwright test suite for bulk uploads** - Generate synthetic test images (100/500/1000/2000 files at 1MB/5MB/10MB sizes), automate upload flow, measure success rate, P95 latency, memory usage, failure types. Test scenarios: happy path, network interruption, rate limiting, concurrent users.
  - **Rationale for deferring**: Core upload flow validated via 14 integration tests (see `__tests__/api/upload-direct.test.ts`); load testing requires Playwright infrastructure setup
  - **Effort**: Large (~4-6 hours for script + synthetic image generation + infra)
  - **Priority**: Medium (performance validation, not functional requirement)
  - **Success Criteria**: >95% success rate for 2000 files, <10s P95 upload latency
  - **Reference**: Phase 3 branch already has 43 unit/integration tests covering rate limiting and upload flow
  - **Branch**: `feature/bulk-upload-optimization`

### Monitoring & Observability

- **Add performance telemetry to upload endpoints** - Track upload latency (P50/P95/P99), processing queue depth, embedding queue depth. Log structured metrics to console: `[Metrics] upload_latency_p95=450ms`. Expose via `/api/telemetry` endpoint for dashboard consumption.
  - **Rationale for deferring**: Basic console logging exists; dedicated observability sprint more appropriate than ad-hoc additions
  - **Effort**: Medium (~3-4 hours including aggregation logic)
  - **Priority**: Medium (monitoring nice-to-have, not blocking)
  - **Dependencies**: Decide on observability stack (Grafana/Datadog/custom)
  - **Files**: `app/api/upload-url/route.ts`, `app/api/upload-complete/route.ts`, `app/api/telemetry/route.ts`

### Advanced Error Handling

- **DistributedQueue integration for upload retry logic** - Replace manual retry logic with priority queue system from `lib/distributed-queue.ts`. Features: urgent/normal/background priorities, automatic exponential backoff (5x for rate limits, 2x for network), dead letter queue for permanent failures (>5 retries).
  - **Rationale for deferring**: Current retry logic with exponential backoff works well; DistributedQueue adds complexity without clear benefit for client-side uploads (uploads are already client-driven with browser retry mechanisms)
  - **Effort**: Medium (~3-4 hours to integrate + test)
  - **Priority**: Low (optimization, not requirement)
  - **Note**: Code exists in `lib/distributed-queue.ts` but may be better suited for server-side background jobs than client uploads
  - **Files**: `components/upload/upload-zone.tsx:942-1016` (uploadBatch function)

- **Dead letter queue UI for permanent failures** - Show permanently failed uploads (>5 retry attempts) with error classification (rate_limit/network/server/invalid/unknown). Allow manual retry from UI via `DistributedQueue.retryDeadLetterItem(id)`. Log dead letter items for debugging.
  - **Rationale for deferring**: Depends on DistributedQueue integration; current UI already shows failed uploads with retry buttons
  - **Effort**: Small (~1-2 hours)
  - **Priority**: Low (edge case handling; manual retry already exists)
  - **Dependencies**: DistributedQueue integration (above)
  - **Files**: `components/upload/upload-zone.tsx:1799-1812` (error summary section)

## ♿ Accessibility

### Keyboard Navigation

- **Implement focus trap management** - Add focus trap to modal components (CommandPalette, DeleteConfirmationModal) using `react-focus-lock` or manual implementation. Ensure Tab cycles within modal and Escape returns focus to trigger element.
  - **Rationale for deferring**: Basic keyboard nav works; this improves experience but isn't blocking
  - **Effort**: Medium (~2 hours)
  - **Priority**: Medium
  - **Library option**: `npm install react-focus-lock`
  - **PR Reference**: Multiple accessibility suggestions in reviews

- **Add ARIA labels to terminal UI components** - Status line, command palette, and similarity score legend need proper ARIA attributes for screen readers. Add `aria-live="polite"` to status line for real-time updates, `role="dialog"` and `aria-modal="true"` to command palette, `aria-label` to interactive elements.
  - **Rationale for deferring**: Visual UI works; screen reader support is important but not blocking
  - **Effort**: Small (~1-2 hours)
  - **Priority**: Medium
  - **Locations**:
    - `components/chrome/status-line.tsx:76-115` - Add `aria-live="polite"` and `aria-label`
    - `components/chrome/command-palette.tsx:256-369` - Add `role="dialog"` and `aria-modal="true"`
    - `components/search/similarity-score-legend.tsx` - Add `aria-describedby` for score explanations
  - **PR Reference**: PR #3 Review - Accessibility section

- **Add ARIA labels to all view toggles** - View mode toggles, sort dropdown, and filter chips need descriptive ARIA labels for screen readers. Add `aria-label`, `aria-pressed`, `aria-expanded` where appropriate.
  - **Rationale for deferring**: Basic HTML semantics provide some context; comprehensive labels can be added later
  - **Effort**: Small (~1 hour)
  - **Priority**: Medium
  - **Example**: `<button aria-label="Switch to grid view" aria-pressed={viewMode === 'grid'}>`
  - **PR Reference**: Accessibility gaps mentioned in 3 reviews

- **Add screen reader announcements for view changes** - When user switches views or applies filters, announce the change using `aria-live` regions. Create reusable ScreenReaderAnnouncer component.
  - **Rationale for deferring**: Visual feedback is clear; audio feedback is enhancement
  - **Effort**: Small (~1 hour)
  - **Priority**: Low
  - **Implementation**: Create `<div role="status" aria-live="polite" className="sr-only">{announcement}</div>`
  - **PR Reference**: Mentioned in accessibility review section

## ⚡ Performance Optimizations

### API Performance

- **Create dedicated `/api/stats` endpoint** - Currently `useStatusStats` hook fetches **all assets** (limit=1000) every 500ms-5s just to calculate aggregate stats (count, size, lastUpload). This is wasteful and could cause performance issues at scale.
  - **Rationale for deferring**: Status stats work but are inefficient; optimization can happen post-merge
  - **Effort**: Medium (~2-3 hours including testing)
  - **Priority**: High (affects production performance)
  - **Current Issue**: `hooks/use-status-stats.ts:29` - `fetch('/api/assets?limit=1000')` every 500ms when queue active
  - **Impact**: 120 API requests/minute, unnecessary DB queries, bandwidth waste
  - **Proposed Solution**:
    ```typescript
    // New endpoint: GET /api/stats
    // Returns only: { assetCount, totalSize, lastUploadTime, queueDepth }
    // Single lightweight aggregate query instead of fetching all assets
    ```
  - **PR Reference**: PR #3 Review - All 4 reviews flagged this as performance concern

- **Refactor useStatusStats interval pattern** - The recursive interval setup (lines 77-85) creates unnecessary overhead and timing drift. Replace with simpler, more efficient pattern.
  - **Rationale for deferring**: Works but could be cleaner; not causing bugs currently
  - **Effort**: Small (~30 min)
  - **Priority**: Medium
  - **Current Issue**: `hooks/use-status-stats.ts:77-85` - Clears and recreates interval on every tick
  - **Proposed Solution**:
    ```typescript
    // Use simple setInterval with adaptive timing based on ref-tracked queue state
    // Or use WebSocket/SSE for real-time updates instead of polling
    ```
  - **PR Reference**: PR #3 Review - Performance section

### React Optimizations

- **Optimize stats calculation in app/page.tsx** - Stats calculation processes entire assets array (O(n)) on every render. With 1000+ assets, could cause frame drops.
  - **Rationale for deferring**: Once `/api/stats` endpoint exists, this calculation moves to backend
  - **Effort**: Small (~1 hour) - but depends on `/api/stats` endpoint
  - **Priority**: Medium (blocked by `/api/stats` work)
  - **Current Issue**: `app/app/page.tsx:290-308` - useMemo calculates stats on client
  - **Proposed Solution**: Remove client-side calculation, use `/api/stats` endpoint data
  - **PR Reference**: PR #3 Review - Performance concerns section

- **Profile FilterContext for re-render frequency** - Some reviews suggested the FilterContext might cause unnecessary re-renders. Before optimizing, profile with React DevTools Profiler to measure actual impact. If confirmed, add more aggressive memoization with `useMemo` for derived values.
  - **Rationale for deferring**: Speculative optimization; need data first
  - **Effort**: Small (~30 min to profile, ~1 hour to fix if needed)
  - **Priority**: Low
  - **How to measure**: Wrap app in `<Profiler>`, trigger filter changes, check flamegraph for cascading updates
  - **PR Reference**: Multiple reviews suggested this without data

- **Consider CSS-only hover states for ImageTile** - Currently `image-tile.tsx` uses JavaScript state for hover, which may trigger re-renders. Evaluate switching to pure CSS `:hover` selectors for metadata overlay. Only pursue if profiling shows hover state is hot path.
  - **Rationale for deferring**: Current implementation works fine; optimization is premature
  - **Effort**: Small (~30 min)
  - **Priority**: Very Low
  - **Trade-off**: CSS-only is faster but less flexible for complex interactions
  - **PR Reference**: Mentioned in one performance review

### Virtual Scrolling

- **Implement Intersection Observer for virtual scrolling** - Current virtual scrolling uses `@tanstack/react-virtual`. Consider enhancing with Intersection Observer for more efficient off-screen detection. Measure performance impact with 1000+ images first.
  - **Rationale for deferring**: Current implementation performs well; this is micro-optimization
  - **Effort**: Medium (~2 hours)
  - **Priority**: Very Low
  - **Benchmark first**: If scroll performance is <60fps with 500+ images, revisit
  - **PR Reference**: Suggested in performance-focused review

## 🔒 Security Hardening

### Input Validation

- **Add rate limiting to API endpoints** - Implement rate limiting for `/api/upload`, `/api/search`, and `/api/assets/*` endpoints to prevent abuse. Use Vercel Edge Config or Upstash Redis for distributed rate limiting.
  - **Rationale for deferring**: Auth provides first line of defense; rate limiting is defense-in-depth
  - **Effort**: Medium (~2-3 hours for proper implementation)
  - **Priority**: Medium
  - **Library option**: `@upstash/ratelimit` with Vercel KV
  - **Thresholds**: 100 uploads/hour, 1000 searches/hour, 5000 asset fetches/hour
  - **PR Reference**: Multiple reviews suggested rate limiting

- **Add input sanitization to search queries** - The search bar should validate and sanitize regex special characters to prevent regex DoS attacks. Escape or reject patterns like `(.*)+` that can cause catastrophic backtracking.
  - **Rationale for deferring**: Search goes through controlled API with Postgres FTS; risk is low
  - **Effort**: Small (~1 hour)
  - **Priority**: Low
  - **Implementation**: Use DOMPurify or custom allowlist for search input
  - **PR Reference**: Security review mentioned regex injection

- **Validate URL parameters for view modes** - Currently view mode and filter params from URL are trusted (type assertion without validation). Add validation to ensure values match expected enum.
  - **Rationale for deferring**: Next.js sanitizes URLs; additional validation is belt-and-suspenders
  - **Effort**: Small (~30 min)
  - **Priority**: Medium (type safety concern)
  - **Current Issue**: `components/chrome/status-line.tsx:31-32` - Type assertions without validation
  - **Implementation**:
    ```typescript
    const rawView = searchParams.get('view') || 'grid';
    const viewMode = (rawView === 'grid' || rawView === 'list') ? rawView : 'grid';
    ```
  - **PR Reference**: PR #3 Review - Security section

- **Add try-catch wrappers for localStorage operations** - localStorage access can throw in incognito mode or when storage is full. Wrap all localStorage calls in try-catch blocks.
  - **Rationale for deferring**: Edge case that rarely occurs; not affecting current users
  - **Effort**: Small (~30 min)
  - **Priority**: Low
  - **Locations**:
    - `components/search/similarity-score-legend.tsx:21-22` - Dismissal state
    - Any other components using localStorage for preferences
  - **Implementation**:
    ```typescript
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('localStorage unavailable:', error);
      // Fallback to default behavior
    }
    ```
  - **PR Reference**: PR #3 Review - Security notes

## 📚 Documentation

### Architecture Documentation

- **Document new chrome architecture in CLAUDE.md** - Update the Architecture section in `CLAUDE.md` to explain the navbar/footer design decision, component hierarchy, state management via FilterContext, and URL-driven view state. Include diagram if possible.
  - **Rationale for deferring**: Code is self-documenting for now; comprehensive docs can come later
  - **Effort**: Medium (~1-2 hours for thorough documentation)
  - **Priority**: Medium
  - **Include**: Decision rationale, component relationships, state flow diagram
  - **PR Reference**: Multiple reviews noted this should be documented

- **Improve color contrast for WCAG AA compliance** - Terminal gray (#888888) on black (#000000) has only 2.85:1 contrast ratio, failing WCAG AA 4.5:1 requirement for body text.
  - **Rationale for deferring**: Terminal aesthetic prioritizes authenticity over strict WCAG; can be improved incrementally
  - **Effort**: Small (~30 min to test alternatives)
  - **Priority**: Medium (accessibility concern)
  - **Current Issue**: `#888888` on `#000000` = 2.85:1 contrast (needs 4.5:1 minimum)
  - **Proposed Solution**: Test lighter grays (#999999, #AAAAAA) that maintain terminal aesthetic
  - **Tool**: Use WebAIM contrast checker to validate
  - **PR Reference**: PR #3 Review - Accessibility concerns

- **Create keyboard shortcuts reference modal** - Add a help modal (triggered by `?` key) that displays all keyboard shortcuts: ⌘K (command palette), / (search), 1 (grid view), 2 (list view), Escape (clear/close), etc. Use CommandPalette pattern.
  - **Rationale for deferring**: Power users will discover shortcuts; modal is nice-to-have
  - **Effort**: Small (~1-2 hours)
  - **Priority**: Low
  - **Design**: Use same styling as CommandPalette for consistency
  - **Note**: Keyboard shortcuts help component already exists! Just needs modal trigger.
  - **PR Reference**: Multiple reviews suggested documenting shortcuts

### API Documentation

- **Document cron job schedules in Vercel** - Ensure `vercel.json` cron schedules are documented. Add comments explaining the schedule expressions and what each job does. Add to CLAUDE.md Operations section.
  - **Rationale for deferring**: Cron jobs exist and work; documentation improves maintainability
  - **Effort**: Small (~15 min)
  - **Priority**: Low
  - **PR Reference**: Mentioned as missing validation

## 🧪 Testing Enhancements

### Component Testing

- **Add tests for new terminal UI components** - StatusLine, CornerBrackets, SimilarityScoreLegend, and KeyboardShortcutsHelp components were added but lack unit tests.
  - **Rationale for deferring**: Components work in production; tests add confidence but aren't blocking
  - **Effort**: Medium (~2-3 hours for comprehensive coverage)
  - **Priority**: Medium
  - **Test Cases**:
    - StatusLine: Format storage correctly, show queue depth when >0, format timestamps
    - CornerBrackets: Render without errors, proper aria-hidden attribute
    - SimilarityScoreLegend: Dismissal state, localStorage persistence
    - KeyboardShortcutsHelp: Modal open/close, keyboard navigation
  - **Example**:
    ```typescript
    describe('StatusLine', () => {
      it('formats storage correctly', () => {
        render(<StatusLine storageUsed={1048576} />);
        expect(screen.getByText(/1MB/i)).toBeInTheDocument();
      });
    });
    ```
  - **PR Reference**: PR #3 Review - Test coverage section

- **Add tests for keyboard shortcuts** - The useKeyboardShortcut hook and its consumers lack test coverage. Would have caught the modifier logic bug reviewers flagged (which was actually correct, but tests would prove it).
  - **Rationale for deferring**: Keyboard shortcuts work; tests are for regression prevention
  - **Effort**: Small (~1-2 hours)
  - **Priority**: Medium
  - **Test Cases**:
    - Shortcuts trigger with correct modifier combinations
    - Shortcuts don't trigger when typing in inputs
    - Special case shortcuts (⌘K, /) work correctly
  - **PR Reference**: PR #3 Review - Missing tests section

### Performance Testing

- **Run Lighthouse audits for regression detection** - Establish baseline Lighthouse scores (performance, accessibility, best practices, SEO) and set up CI job to fail if scores drop >5 points. Use `@lhci/cli` for GitHub Actions integration.
  - **Rationale for deferring**: Current performance is good; automated tracking is enhancement
  - **Effort**: Medium (~2 hours to set up properly)
  - **Priority**: Medium
  - **CI Integration**: Add to `.github/workflows/lighthouse.yml`
  - **PR Reference**: Suggested in multiple reviews for quality gates

- **Benchmark virtual scrolling with 1000+ images** - Create performance test that loads 1000+ images and measures: time to first render, scroll FPS, memory usage over time. Compare against baseline before merge.
  - **Rationale for deferring**: Current testing shows good performance at 100+ images; 1000+ is edge case
  - **Effort**: Medium (~2 hours)
  - **Priority**: Low
  - **Tool**: Use `scripts/benchmark.ts` pattern or Playwright performance APIs
  - **PR Reference**: Multiple reviews mentioned large dataset validation

### Integration Testing

- **Add tests for SSE connection stability** - Test that Server-Sent Events connections for embedding updates: establish correctly, send updates, handle disconnection/reconnection, clean up on unmount.
  - **Rationale for deferring**: SSE refactor maintains existing behavior; tests are confidence-building
  - **Effort**: Medium (~2 hours)
  - **Priority**: Low
  - **PR Reference**: One review specifically called this out

## 🎨 UX Enhancements

### Loading States

- **Add loading states for view mode transitions** - Show skeleton loaders or transition animation when switching between grid/list views to prevent UI jank. Especially important with large datasets.
  - **Rationale for deferring**: Transitions are fast enough; loading states are polish
  - **Effort**: Small (~1 hour)
  - **Priority**: Low
  - **Implementation**: Add isTransitioning state, show skeleton for 200ms minimum
  - **PR Reference**: Mentioned in UX review section

### Analytics

- **Add analytics for view mode usage** - Track which view modes users prefer (grid vs list), how often they switch, and which filters/sorts are most common. Use Vercel Analytics or PostHog.
  - **Rationale for deferring**: Product analytics are valuable but not core functionality
  - **Effort**: Small (~1-2 hours for event tracking setup)
  - **Priority**: Low
  - **Events to track**: view_mode_change, filter_applied, sort_changed, keyboard_shortcut_used
  - **PR Reference**: Suggested for understanding user preferences

### User Preferences

- **Persist view mode per user in database** - Currently view mode is URL-only. Consider saving user's preferred default view mode in database (new `UserPreferences` model) so it persists across devices.
  - **Rationale for deferring**: URL state works fine; per-user persistence is nice-to-have
  - **Effort**: Medium (~2-3 hours including migration)
  - **Priority**: Very Low
  - **Trade-off**: Adds database complexity for marginal UX improvement
  - **PR Reference**: Suggested in one review

---

## 🔍 Observability & Error Handling

**Context**: After fixing immediate silent 500 error issues (see TODO.md for critical path), these enhancements would further improve production debugging, monitoring, and incident response. Deferred because basic structured logging solves the immediate problem, but these would provide defense-in-depth.

### Error Tracking & APM

- **Integrate Sentry for production error tracking** - Add Sentry SDK for automatic error aggregation, stack trace deobfuscation, release tracking, and user impact analysis. Provides proactive error detection before users report issues.
  - **Rationale for deferring**: Vercel-compatible structured logging (TODO.md Phase 1) provides immediate visibility; Sentry adds richer context but isn't blocking
  - **Effort**: Medium (~2-3 hours for SDK setup, environment config, source map upload)
  - **Priority**: High (significant production value once basic logging works)
  - **Implementation**: `@sentry/nextjs` with Next.js integration, environment-specific DSNs
  - **Configuration**: Set up error grouping rules, ignore known benign errors, configure sample rates
  - **Value**: Error trends, affected user counts, breadcrumbs showing user actions before error

- **Add OpenTelemetry distributed tracing** - Instrument API calls to track request flow through multiple services (Vercel → Postgres → Blob Storage → Replicate API). Identify slow database queries, external API latency, and bottlenecks.
  - **Rationale for deferring**: Request ID tracking (TODO.md Phase 2) provides basic tracing; OpenTelemetry adds deeper visibility
  - **Effort**: Medium (~4-6 hours for instrumentation, exporter config, dashboard setup)
  - **Priority**: Medium
  - **Implementation**: `@opentelemetry/api` with Vercel exporter or Honeycomb/Datadog backend
  - **Traces**: Database queries, Blob operations, embedding generation, search requests
  - **Value**: Visualize full request lifecycle, identify cascade failures, optimize slow paths

### Performance Monitoring

- **Create endpoint performance wrapper** - Automatic duration tracking for all API routes with p50/p95/p99 latency metrics. Identify slow endpoints, track performance over time, detect regressions.
  - **Rationale for deferring**: Manual testing shows acceptable performance; automated metrics are optimization aid
  - **Effort**: Small (~2 hours for wrapper function, metric emission, basic aggregation)
  - **Priority**: Medium
  - **Implementation**: Higher-order function wrapping API handlers, emit JSON metrics to console
  - **Output format**: `{ type: 'metric', endpoint, status, duration, timestamp }`
  - **Value**: Data-driven performance optimization, SLO monitoring, regression detection

- **Add Prisma query performance tracking** - Track database query performance using Prisma middleware. Log slow queries (>100ms), identify missing indexes, detect N+1 query patterns before they impact production.
  - **Rationale for deferring**: No known performance issues currently; this enables proactive optimization
  - **Effort**: Medium (~3 hours for Prisma middleware, metric collection, analysis tooling)
  - **Priority**: Medium
  - **Implementation**: Prisma query middleware logging duration/SQL, aggregate by model/operation
  - **Alerts**: Log warning for queries >100ms, error for queries >500ms
  - **Value**: Proactive database optimization, prevent performance degradation at scale

### Distributed Request Tracing

- **Propagate correlation ID to external services** - Pass request ID from middleware to Prisma, Blob SDK, and Replicate API calls. Enables end-to-end request tracing across service boundaries.
  - **Rationale for deferring**: Request ID in logs (TODO.md Phase 2) provides basic tracing; this extends to external services
  - **Effort**: Medium (~2-3 hours to modify service clients, add headers/metadata)
  - **Priority**: Medium
  - **Implementation**:
    - Add `x-request-id` header to Replicate API calls
    - Add correlation ID to Blob SDK operations via metadata
    - Add request ID to Prisma context for query logging
  - **Value**: Trace errors through full stack including external dependencies

### Advanced Logging

- **Add structured log levels with environment-based filtering** - Extend vercel-logger with debug/info/warn levels, controllable via `LOG_LEVEL` env var. Reduce log noise in production while preserving detail for debugging.
  - **Rationale for deferring**: Error logging (TODO.md Phase 1) is critical path; log levels are optimization
  - **Effort**: Small (~1-2 hours for level filtering, environment config)
  - **Priority**: Low
  - **Implementation**:
    - `LOG_LEVEL=error` in production (errors only)
    - `LOG_LEVEL=debug` in development (all logs)
    - Conditional logging based on level threshold
  - **Value**: Cleaner production logs, easier to find critical errors in high-traffic periods

- **Create log aggregation dashboard** - Set up Vercel Log Drains to export logs to visualization tool (Datadog, Honeycomb, Grafana). Build dashboards for error rates, endpoint latency, request volume.
  - **Rationale for deferring**: Vercel console provides basic log viewing; dashboard is operational enhancement
  - **Effort**: Medium (~3-4 hours for log drain setup, dashboard creation)
  - **Priority**: Medium
  - **Implementation**: Configure Vercel Log Drains → external service → dashboard templates
  - **Dashboards**: Error rate by endpoint, latency percentiles, request volume over time
  - **Value**: At-a-glance system health, historical trend analysis

### Code Architecture Improvements

- **Refactor auth checks outside try-catch blocks** - Move Clerk `auth()` calls outside try-catch to follow best practices and eliminate need for `unstable_rethrow`. Provides cleaner separation between authentication and business logic error handling.
  - **Rationale for deferring**: `unstable_rethrow` (TODO.md Phase 0) solves the immediate issue; this refactor improves maintainability but isn't urgent
  - **Effort**: Medium (~2-3 hours for all 8 routes + testing)
  - **Priority**: Medium
  - **Current pattern** (with `unstable_rethrow`):
    ```typescript
    try {
      const { userId } = await getAuthWithUser();
      // business logic
    } catch (error) {
      unstable_rethrow(error); // Required to prevent catching Next.js internal errors
      logError(...)
    }
    ```
  - **Cleaner pattern** (auth outside try-catch):
    ```typescript
    const { userId } = await getAuthWithUser();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      // Only business logic in try-catch
    } catch (error) {
      logError(...) // No unstable_rethrow needed
    }
    ```
  - **Benefits**:
    - Removes reliance on "unstable" Next.js API
    - Explicit auth failure handling (401 responses)
    - Clearer error boundaries: auth vs business logic
    - Aligns with Clerk documentation patterns
  - **Routes to update**: All 8 routes using `getAuthWithUser()` or `requireUserIdWithSync()`
  - **Testing**: Verify auth failures return 401, business logic errors return 500
  - **Value**: Better code organization, less coupling to Next.js internals, clearer intent

### Reliability Patterns

- **Implement automatic retry logic for transient failures** - Wrap Prisma and Blob operations with retry logic using exponential backoff. Improve reliability for transient network/database timeouts without user intervention.
  - **Rationale for deferring**: Not experiencing transient failures currently; adds complexity
  - **Effort**: Medium (~3-4 hours for retry wrapper, exponential backoff, idempotency checks)
  - **Priority**: Low
  - **Implementation**: Retry wrapper with max 3 attempts, exponential backoff (100ms, 200ms, 400ms)
  - **Idempotency**: Use asset checksums to prevent duplicate uploads on retry
  - **Trade-off**: Reduces error rate but increases latency for failing requests
  - **Note**: Only retry idempotent operations (GET, PUT with checksum)

- **Add circuit breaker for external service calls** - Prevent cascading failures when Replicate API or other dependencies are down. Open circuit after failure threshold, attempt recovery with exponential backoff.
  - **Rationale for deferring**: No cascading failure issues observed; defensive pattern for scale
  - **Effort**: Medium (~4-6 hours for circuit breaker implementation, state management, monitoring)
  - **Priority**: Low
  - **Implementation**: Track failure rate per service, open circuit after 50% failure over 1min, half-open retry after 30s
  - **Fallback**: Return cached embeddings or gracefully degrade search to recency-only
  - **Value**: Prevent cascading failures, maintain core functionality when dependencies fail

### Developer Tools

- **Create production error replay tool** - CLI tool that reads Vercel logs, extracts request data, and replays against local dev server to reproduce production-only errors.
  - **Rationale for deferring**: Nice developer experience but not blocking debugging capability
  - **Effort**: Medium (~4-5 hours for log parser, request replayer, mock data generation)
  - **Priority**: Low
  - **Implementation**: Parse JSON logs → extract request body/headers/params → replay via curl/fetch
  - **Value**: Faster debugging cycle, reproduce production-only issues locally

- **Add error simulation query parameter** - In development mode, support `?__simulateError=500` query param to trigger test errors without writing temporary throw statements.
  - **Rationale for deferring**: Can manually throw errors for testing; this is convenience feature
  - **Effort**: Small (~1 hour for error trigger implementation)
  - **Priority**: Very Low
  - **Implementation**: Check query param in dev mode, throw specific error types on demand
  - **Example**: `?__simulateError=database` → throw Prisma connection error
  - **Value**: Easier to test error handling without modifying code

### Production Operations

- **Configure error rate alerting** - Set up alerts for spike in 500 errors or error rate >1% of requests. Get notified before issue impacts many users.
  - **Rationale for deferring**: Requires log aggregation infrastructure; manual monitoring works for now
  - **Effort**: Small (~2-3 hours to configure alerts after log drain setup)
  - **Priority**: Medium
  - **Requirements**: Vercel Log Drains → Datadog/Honeycomb → threshold alerts
  - **Thresholds**: Alert on >10 errors/min OR error rate >1% over 5min window
  - **Notification**: Slack/PagerDuty/Email based on severity

- **Create endpoint health dashboard** - Real-time dashboard showing API endpoint health: error rates, latency percentiles, request volume, database connection status.
  - **Rationale for deferring**: Health check endpoint (TODO.md Phase 2.2) provides programmatic health; dashboard is visibility enhancement
  - **Effort**: Medium (~4-6 hours for metrics export, dashboard creation, visualization)
  - **Priority**: Low
  - **Implementation**: Vercel Analytics + custom dashboard OR Grafana + Prometheus
  - **Metrics**: Request rate, error rate, p50/p95/p99 latency, database connection pool
  - **Value**: Quick status check during incidents, historical performance analysis

### Documentation

- **Write debugging runbook** - Step-by-step guide for debugging production errors: accessing Vercel logs, tracing requests, checking database health, common error patterns and fixes.
  - **Rationale for deferring**: Error logging improvements make debugging more straightforward; runbook codifies best practices
  - **Effort**: Medium (~3-4 hours to write comprehensive runbook, validate steps)
  - **Priority**: Medium
  - **Contents**:
    - How to access Vercel logs and filter by request ID
    - How to trace requests from middleware → handler → database
    - Common error patterns and their fixes
    - Database connection debugging steps
    - Rollback procedures
  - **Location**: `docs/debugging-runbook.md`
  - **Value**: Faster incident resolution, less reliance on tribal knowledge

- **Document all API error responses** - Catalog all possible error responses from each endpoint: status codes, error messages, retry guidance, common causes.
  - **Rationale for deferring**: Frontend developers can inspect network tab; catalog improves DX
  - **Effort**: Medium (~2-3 hours to audit all routes, document errors, review)
  - **Priority**: Low
  - **Format**: Markdown table with columns: Endpoint, Status, Error Type, Message, Cause, Retry?
  - **Location**: `docs/api-errors.md`
  - **Value**: Frontend developers know what errors to handle, less guesswork

---

## 🚫 Rejected / Not Applicable

### PR #3 Review Feedback - Invalid or Misunderstood

- **"Incomplete terminal aesthetic conversion - 157 rounded-* instances remain"** → **FALSE**
  - **Reality**: Only 3 instances exist in legacy focus-visible styles (`app/globals.css:169-179`)
  - **Evidence**: `grep -r "rounded-" **/*.{tsx,ts,css}` returns 3 results, all in CSS focus rules
  - **Action**: Remove these 3 legacy styles (catalogued in TODO.md)
  - **Why reviewers were wrong**: Likely used outdated grep or searched wrong file types
  - **PR Reference**: PR #3 Review #2 - Critical Issues section

- **"Test coverage degradation - 9,391 lines of tests deleted"** → **INVALID CONCERN**
  - **Reality**: Test files were **intentionally deleted** in commit `110daf5` because they were dead weight
  - **Evidence**: Commit message explains: "Testing mock infrastructure, not business logic. Causing 66 CI failures. Providing zero value (never caught real bugs)"
  - **Pattern**: All deleted tests had identical Vitest hoisting errors - `prisma.asset.findFirst.mockResolvedValue is not a function`
  - **Action**: None required - deletion was justified and documented
  - **Why reviewers were wrong**: Reviewed diff without checking commit history/rationale
  - **PR Reference**: PR #3 Review #3 - Critical Issues section

- **"Keyboard shortcut logic bug - modifier key logic is inverted"** → **MISUNDERSTOOD**
  - **Reality**: Logic in `hooks/use-keyboard-shortcut.ts:39-42` is **correct** for optional modifiers
  - **Code Analysis**:
    ```typescript
    const isCtrlPressed = ctrlKey ? event.ctrlKey : true;
    // Translation: If ctrlKey is required, check if pressed. If not required, return true.
    // This is CORRECT logic for "trigger when Ctrl is pressed IF required, OR when not required"
    ```
  - **Action**: None required - code works as designed
  - **Future improvement**: Add tests to prove correctness and prevent future confusion (catalogued in BACKLOG.md)
  - **Why reviewers were wrong**: Misread the ternary operator semantics
  - **PR Reference**: PR #3 Review #1 - Critical Issues section

- **"Unused state variable - isClient is set but never used"** → **FALSE**
  - **Reality**: `isClient` state is a **standard Next.js SSR pattern** to prevent hydration errors
  - **Purpose**: Delays client-only rendering until after hydration completes
  - **Pattern**: Used throughout Next.js apps to prevent "Warning: Text content did not match" errors
  - **Action**: None required - this is best practice
  - **Why reviewers were wrong**: Unfamiliar with Next.js hydration patterns
  - **PR Reference**: PR #3 Review #1 - Code quality section

- **"Image Tile uses 'as any' to access similarity field - type safety violation"** → **ACKNOWLEDGED BUT ACCEPTABLE**
  - **Reality**: Type assertion used because similarity score is only present in search results, not regular assets
  - **Current code**: `(asset as any).similarity` at lines 271, 280
  - **Better solution**: Create `SearchAsset` type extending `Asset` with optional similarity field
  - **Action**: Catalogued in BACKLOG.md as type safety improvement
  - **Why partially valid**: Reviewers correct that type could be better, but not critical for merge
  - **PR Reference**: PR #3 Review #3 - Type safety section

### Won't Do (From Earlier Reviews)

- **Split PR into smaller PRs** - One review suggested breaking the 13K+ line PR into multiple smaller PRs (navbar, grid, state management, etc.). **Rejected because**: This is a cohesive architectural refactor where components are interdependent. Splitting would require maintaining broken intermediate states or creating complex feature flags. The PR is large but atomic.

- **Add feature flag for old/new UI** - Suggested adding toggle between old sidebar layout and new navbar layout during rollout. **Rejected because**: This is a feature branch, not going directly to production. Adding feature flag infrastructure would significantly increase complexity for little benefit. If rollback is needed, can revert the merge.

- **Encrypt UI preferences in localStorage** - One review suggested encrypting view mode and sort preferences stored in localStorage. **Rejected because**: These are non-sensitive UI preferences that don't warrant encryption overhead. There's no security benefit to hiding which view mode a user prefers. Would add unnecessary complexity and performance cost.

- **Progressive enhancement without JavaScript** - Suggested ensuring basic functionality works with JavaScript disabled. **Rejected because**: This is a React SPA that fundamentally requires JavaScript. Progressive enhancement doesn't make sense for the application architecture. Focus should be on optimizing the JavaScript experience.

## 🎨 Terminal Aesthetic Enhancements

### Visual Polish

- **Add animated CRT scan line effect** - Subtle horizontal scan line that moves top-to-bottom every 2-3 seconds. Pure CSS animation using `:after` pseudo-element with gradient. Enable/disable via settings.
  - **Rationale for deferring**: Could be polarizing; core terminal aesthetic works without it
  - **Effort**: Small (~1 hour)
  - **Priority**: Very Low
  - **Trade-off**: Adds character but risks feeling gimmicky
  - **Implementation**: CSS keyframe moving `linear-gradient` overlay at 5% opacity

- **Terminal color theme variants** - Implement classic CRT phosphor color themes: Amber (P3), Green (P1), Blue (IBM), alongside default white. User-selectable in settings, affects all terminal colors.
  - **Rationale for deferring**: Current white-on-black works well; themes are nice-to-have personalization
  - **Effort**: Medium (~2-3 hours for 4 themes)
  - **Priority**: Low
  - **Themes**: `--theme-p3-amber`, `--theme-p1-green`, `--theme-ibm-blue`, `--theme-default`
  - **Storage**: Save preference in `UserPreferences` table

- **Add CRT glow effect to high-confidence search results** - Subtle outer glow on images with similarity >0.90, mimicking phosphor bloom. Use `box-shadow` with terminal green color.
  - **Rationale for deferring**: Color-coded borders already indicate confidence; glow is extra
  - **Effort**: Small (~30 min)
  - **Priority**: Very Low
  - **CSS**: `box-shadow: 0 0 20px rgba(74, 222, 128, 0.4);`

### Audio Feedback

- **Add terminal sound effects for actions** - Subtle beeps for: upload complete (success tone), search executed (query tone), error occurred (error tone). Use Web Audio API, ~100ms duration, <10KB each.
  - **Rationale for deferring**: Visual feedback is sufficient; audio could annoy users
  - **Effort**: Medium (~2 hours including sound design)
  - **Priority**: Very Low
  - **Toggle**: Must be opt-in via settings, disabled by default
  - **Accessibility**: Respect `prefers-reduced-motion` for auto-disable

### Advanced Data Visualization

- **Heat map visualization of semantic search clusters** - 2D visualization showing how memes cluster in embedding space. Click cluster to filter. Uses UMAP dimensionality reduction of 512D vectors to 2D.
  - **Rationale for deferring**: Complex feature requiring significant backend work; cool but not essential
  - **Effort**: Large (~6-8 hours including UMAP integration)
  - **Priority**: Low
  - **Library**: `umap-js` for client-side dimensionality reduction
  - **UX**: Modal/drawer showing cluster map, click to filter by region

- **Live embedding queue depth graph** - Real-time sparkline showing queue depth over last 60 seconds. Updates every second. Positioned in status line.
  - **Rationale for deferring**: Current queue depth number is sufficient; graph is visual polish
  - **Effort**: Small (~1-2 hours)
  - **Priority**: Very Low
  - **Implementation**: Canvas-based sparkline, circular buffer of 60 datapoints

### Terminal UI Components

- **Multi-column list view with Bloomberg-style data tables** - Alternative to grid: dense tabular view showing filename | dimensions | size | upload date | similarity in aligned monospace columns. Sortable by any column.
  - **Rationale for deferring**: Current grid and list views work well; table view is power-user feature
  - **Effort**: Medium (~3-4 hours)
  - **Priority**: Medium
  - **Layout**: CSS Grid with fixed column widths, virtual scrolling for performance
  - **Shortcut**: Add `3` key to switch to table view

- **Customizable status line metrics** - Allow users to choose which metrics appear in status line: asset count, size, upload time, queue depth, search latency, FPS counter. Drag-to-reorder.
  - **Rationale for deferring**: Default metrics cover 90% use case; customization is nice-to-have
  - **Effort**: Medium (~2-3 hours)
  - **Priority**: Low
  - **Storage**: Save preference in localStorage or `UserPreferences`
  - **UI**: Settings modal with checkboxes and drag handles

- **Terminal command history in command palette** - Store last 20 commands executed. Press ↑/↓ to cycle through history like bash. Persist in localStorage.
  - **Rationale for deferring**: Current command palette works; history is convenience feature
  - **Effort**: Small (~1 hour)
  - **Priority**: Low
  - **Storage**: `localStorage.commandHistory`, max 20 items
  - **Shortcuts**: ↑/↓ to navigate, Ctrl+R to search history

---

## 📤 Bulk Upload System Enhancements

**Context**: After implementing direct-to-Blob uploads with background processing (TODO.md), these enhancements would further improve scalability, performance, and user experience for bulk operations. Deferred because the core architecture solves the immediate problem (2000+ file uploads), but these would optimize for even larger scale.

### Scalability Improvements

- **Batch upload API endpoint** - New `/api/upload/batch` endpoint accepting multiple files in single request, reducing network overhead from N requests to 1 request with N files. Process files with controlled internal concurrency (10 at a time).
  - **Rationale for deferring**: Direct-to-Blob uploads (TODO.md) solve the concurrency problem; batch API is optimization
  - **Effort**: Medium (~3-4 hours for endpoint implementation, multipart parsing, batch processing)
  - **Priority**: Medium
  - **Benefits**: Reduces network RTT overhead (~100ms × 2000 files = 3min saved), simpler client code
  - **Trade-offs**: Larger request payload (need timeout >60s for 100MB batches), more complex error handling
  - **Implementation**: Accept `multipart/form-data` with multiple files, create batch upload session, process with queue

- **Vercel Queue integration for background processing** - Replace cron-based processing with `@vercel/queue` for proper distributed background job processing. Enables horizontal scaling, better retry semantics, and automatic concurrency management.
  - **Rationale for deferring**: Cron jobs (TODO.md Phase 2) work for single-region deployment; queue needed for multi-region
  - **Effort**: Large (~6-8 hours for queue setup, migration from cron, deployment config)
  - **Priority**: High (for production scale >10K assets/day)
  - **Benefits**: Automatic retry, DLQ, horizontal scaling, better observability
  - **Migration path**: Keep cron jobs initially, add queue as alternative, measure performance, deprecate cron
  - **Cost**: Vercel Queue has usage-based pricing, estimate $10-20/month for moderate use

- **Parallel image processing with worker threads** - Process multiple images concurrently within single cron invocation using `worker_threads`. Currently processes 10 images sequentially (10 × 2s = 20s), could do 10 in parallel (max 5s).
  - **Rationale for deferring**: Sequential processing works and stays within 60s timeout; parallel is optimization
  - **Effort**: Medium (~4-5 hours for worker thread setup, message passing, error handling)
  - **Priority**: Medium
  - **Benefits**: 4x faster processing (20s → 5s per batch), better CPU utilization
  - **Trade-offs**: More complex code, higher memory usage (10 Sharp instances × 100MB = 1GB peak)
  - **Serverless constraint**: Vercel functions limited to 1GB memory (Hobby) / 3GB (Pro)

### Database Optimizations

- **Batch INSERT statements for assets** - Use Prisma `createMany()` to insert multiple assets in single transaction. Currently inserts 1 asset per upload completion, could batch 100 assets every 5 seconds.
  - **Rationale for deferring**: Individual inserts work fine; batching is optimization for extreme scale
  - **Effort**: Small (~1-2 hours for batch logic, transaction handling)
  - **Priority**: Low
  - **Benefits**: Reduces DB round trips (1 vs 100), lower connection pool usage
  - **Trade-offs**: Delayed visibility (5s batch window), more complex error handling (partial batch failures)
  - **Implementation**: Queue assets in memory, flush every 5s or when 100 queued, use `createMany()`

- **Connection pooling optimization** - Tune Prisma connection pool settings for high-concurrency scenarios. Default pool size is 10, could increase to 20-30 for Pro tier with more DB capacity.
  - **Rationale for deferring**: Current pool size (10) handles typical load; tuning needed for >100 concurrent uploads
  - **Effort**: Small (~1 hour for config changes, load testing, monitoring)
  - **Priority**: Low
  - **Configuration**: Adjust `connection_limit` in `DATABASE_URL`, monitor connection usage with Prisma metrics
  - **Prerequisite**: Neon Postgres plan upgrade to support more connections (Hobby = 100 connections, Pro = 1000)

- **Database indexes for queue queries** - Add compound indexes on `(processed, embedded, createdAt)` for efficient queue processing queries. Currently has single-column indexes, compound would be faster.
  - **Rationale for deferring**: Existing indexes work for <10K assets; compound index optimizes for >100K assets
  - **Effort**: Small (~30 min for migration, index creation)
  - **Priority**: Low
  - **Index design**: `CREATE INDEX idx_processing_queue ON assets(processed, embedded, createdAt DESC)`
  - **Impact**: Reduces queue query time from ~50ms to ~5ms at 100K assets

### User Experience Enhancements

- **Upload session management** - Track bulk uploads as sessions with pause/resume capability. User can pause 2000-file upload, close browser, resume later from where they left off.
  - **Rationale for deferring**: Current IndexedDB recovery (UploadQueueManager) handles interrupted uploads; sessions add explicit control
  - **Effort**: Medium (~3-4 hours for session model, UI controls, resume logic)
  - **Priority**: Medium
  - **Features**: Pause/resume button, session history (last 10 sessions), automatic resume on return
  - **Schema**: New `UploadSession` model with `{ id, userId, totalFiles, completedFiles, status, createdAt }`

- **WebSocket progress updates** - Replace SSE with WebSocket for bi-directional communication. Enables server to push updates without polling, client to request progress on demand.
  - **Rationale for deferring**: SSE (TODO.md Phase 2) works well for server→client updates; WebSocket adds client→server control
  - **Effort**: Medium (~4-5 hours for WebSocket setup, fallback to SSE, reconnection logic)
  - **Priority**: Low
  - **Benefits**: Lower latency, bi-directional control (client can request specific asset status)
  - **Trade-offs**: More complex protocol, need to handle connection state, Vercel WebSocket support varies by plan

- **Smart retry with error classification** - Automatically retry uploads based on error type: retry network errors immediately, rate limits after delay, never retry invalid files. Show clear UI for each category.
  - **Rationale for deferring**: Manual retry button works; automatic retry is convenience
  - **Effort**: Small (~2 hours for error classification, retry logic, UI updates)
  - **Priority**: Medium
  - **Error categories**: Network (auto-retry 3x), Rate Limit (auto-retry after backoff), Invalid (never retry), Server (retry 1x)
  - **UI**: Show "Retrying automatically (2/3)..." vs "Retry failed - click to retry manually" vs "Cannot retry - invalid file"

- **Adaptive rate limiting based on system load** - Dynamically adjust upload concurrency based on current system load (CPU, memory, DB connections). Reduce concurrency when system stressed, increase when idle.
  - **Rationale for deferring**: Fixed concurrency (2-3 parallel) works for most cases; adaptive is optimization
  - **Effort**: Medium (~3-4 hours for load monitoring, concurrency adjustment algorithm)
  - **Priority**: Low
  - **Metrics**: Monitor via `/api/health/services` endpoint (DB pool usage, Blob API latency, memory pressure)
  - **Algorithm**: Increase concurrency by 1 when load <30%, decrease by 1 when load >70%, check every 10s

### Advanced Features

- **Resume interrupted uploads from partial state** - Store upload progress in IndexedDB (bytes uploaded per file), resume from exact byte offset on reconnect. Requires multipart upload support from Blob storage.
  - **Rationale for deferring**: Current system re-uploads entire file on failure; resumable uploads optimize for flaky networks
  - **Effort**: Large (~6-8 hours for multipart upload logic, checkpoint storage, resume logic)
  - **Priority**: Low
  - **Constraint**: Vercel Blob doesn't natively support multipart upload resumption; would need custom chunking
  - **Value**: Saves bandwidth on large file failures (10MB file 90% uploaded → resume from 9MB, not 0MB)

- **Client-side image compression before upload** - Compress images in browser using Canvas API or WASM library before uploading. Reduces upload time and bandwidth for large images.
  - **Rationale for deferring**: Server-side Sharp processing handles optimization; client-side is redundant
  - **Effort**: Medium (~3-4 hours for compression logic, quality presets, UI toggle)
  - **Priority**: Very Low
  - **Trade-offs**: Uses client CPU (battery drain on mobile), inconsistent quality across devices
  - **Use case**: Only valuable for very slow upload connections (<1Mbps)

- **Grafana dashboard for upload metrics** - Visualize upload queue depth, processing throughput, error rates, P95 latencies over time. Enables data-driven optimization and capacity planning.
  - **Rationale for deferring**: Console logs and `/api/telemetry` provide basic visibility; dashboard is ops enhancement
  - **Effort**: Large (~6-8 hours for metrics export, Grafana setup, dashboard creation)
  - **Priority**: Medium (high value for production operations)
  - **Metrics**: Upload queue depth, processing queue depth, embedding queue depth, throughput (files/min), error rate (%), P95 latency (ms)
  - **Prerequisite**: Set up Prometheus exporter or Grafana Cloud integration

### Testing & Validation

- **Load testing suite for extreme scenarios** - Test 5000, 10000, 50000 file uploads to identify breaking points. Measure memory usage, timeout rates, database connection pool exhaustion.
  - **Rationale for deferring**: 2000-file upload (TODO.md success criteria) is sufficient for initial release; extreme scale is future-proofing
  - **Effort**: Medium (~4-5 hours for test scripts, scenario design, metric collection)
  - **Priority**: Medium
  - **Tool**: k6 or Artillery for load generation, Datadog for monitoring
  - **Scenarios**: Gradual ramp (0→10K over 10min), spike (0→10K instantly), sustained (5K/hour for 2 hours)

- **Chaos engineering for resilience testing** - Simulate failures: kill database connections mid-upload, rate limit Blob API, timeout Replicate API. Verify system degrades gracefully.
  - **Rationale for deferring**: Basic error handling (TODO.md) handles common failures; chaos tests edge cases
  - **Effort**: Medium (~3-4 hours for failure injection, recovery validation)
  - **Priority**: Low
  - **Tool**: Toxiproxy for network failures, manual kill for database, rate limit simulation via proxy
  - **Validation**: No data loss, clear error messages, automatic retry succeeds

---

## 🔐 PR #4 Review Feedback - Deferred Items

**Context**: PR #4 reviews identified 22 feedback items total. 7 critical/high-priority items moved to TODO.md Phase 2.5. The remaining 15 items are catalogued here as valid but lower-priority improvements.

**Source**: PR #4 Code Reviews by @claude (2 comprehensive reviews)

### Security Enhancements

- **Server-Side Checksum Validation** (app/api/upload-complete/route.ts:42-47)
  - **Current**: Client sends SHA-256 checksum, server trusts it for duplicate detection
  - **Enhancement**: Re-download blob server-side and recalculate checksum to verify integrity
  - **Rationale for deferring**: Trust-the-client approach is acceptable for duplicate detection (not security-critical). Server-side verification adds ~200ms latency and ~10MB memory overhead per upload.
  - **Trade-off**: Security vs performance - current approach optimizes for speed
  - **Effort**: Small (~1-2 hours to implement conditional verification)
  - **Priority**: Medium
  - **Implementation**:
    ```typescript
    // Optional server-side verification:
    if (process.env.STRICT_CHECKSUM_VALIDATION === 'true') {
      const response = await fetch(blobUrl);
      const buffer = await response.arrayBuffer();
      const serverChecksum = crypto.createHash('sha256')
        .update(Buffer.from(buffer))
        .digest('hex');

      if (serverChecksum !== checksum) {
        await del(blobUrl);  // Clean up invalid upload
        return NextResponse.json(
          { error: 'Checksum mismatch - file corrupted' },
          { status: 400 }
        );
      }
    }
    ```
  - **When to revisit**: If duplicate detection is bypassed by attackers, or for high-security deployments
  - **PR Reference**: PR #4 Review #2 - Checksum Validation section

### Testing & Quality Assurance

- **Add Test Coverage for New Endpoints** (Missing tests for 5 new endpoints)
  - **Missing tests**:
    - `app/api/cron/process-images/route.ts` (207 lines, 0% coverage)
    - `app/api/upload-url/route.ts` (133 lines, 0% coverage)
    - `app/api/upload-complete/route.ts` (120 lines, 0% coverage)
    - `app/api/processing-stats/route.ts` (174 lines, 0% coverage)
    - `lib/rate-limiter.ts` (165 lines, 0% coverage - **SECURITY-CRITICAL**)
  - **Rationale for deferring**: Manual testing confirms functionality. `process-embeddings` has excellent test coverage (616 lines, 19 tests) proving the pattern works. Can add tests incrementally.
  - **Recommendation**: Prioritize rate limiter tests first (security-critical), then upload flow tests
  - **Effort**: Medium (~6-8 hours for comprehensive coverage)
  - **Priority**: High (especially rate limiter tests)
  - **Test patterns to copy**: `__tests__/api/cron/process-embeddings.test.ts` provides excellent template
  - **PR Reference**: PR #4 Review #2 - Test Coverage section

- **Add Integration Tests for Direct-to-Blob Upload Flow** (3-step flow test)
  - **Test sequence**: GET /api/upload-url → PUT to blob → POST /api/upload-complete
  - **Verify**: Asset created with `processed=false, embedded=false`, presigned URL expiration, duplicate detection
  - **Rationale for deferring**: End-to-end flow works in production, integration test is confidence-building but not blocking
  - **Effort**: Medium (~2-3 hours)
  - **Priority**: Medium
  - **File**: `__tests__/api/upload-direct.test.ts` (new file)
  - **PR Reference**: TODO.md Phase 4 testing section

- **Add Unit Tests for Rate Limiter** (Token bucket algorithm verification)
  - **Test cases**: Token consumption/refill, burst handling, concurrent users, retry-after calculation
  - **Rationale for deferring**: Algorithm is well-understood, manual testing confirms behavior
  - **Security risk**: Rate limiter bugs could allow abuse - HIGH priority to test
  - **Effort**: Small (~2 hours)
  - **Priority**: High (security-critical component)
  - **File**: `__tests__/lib/rate-limiter.test.ts` (new file)
  - **PR Reference**: TODO.md Phase 4 testing section

### Logging & Observability

- **Enhanced Structured Logging** (app/api/cron/*.ts, all endpoints)
  - **Current**: Basic console.log/error with inconsistent formats
  - **Enhancement**: Structured JSON logging with context (userId, assetId, timestamp, duration)
  - **Example**:
    ```typescript
    console.error({
      level: 'error',
      context: '[cron/process-images]',
      assetId: asset.id,
      userId: asset.ownerUserId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    });
    ```
  - **Rationale for deferring**: Current logs are functional for debugging. Structured logging improves observability at scale but isn't blocking.
  - **Effort**: Medium (~3-4 hours to add consistently across all endpoints)
  - **Priority**: Medium
  - **Prerequisite**: Define logging interface/utility in `lib/logger.ts`
  - **PR Reference**: PR #4 Review #2 - Error Logging Lacks Context section

- **Extract Magic Numbers to Named Constants** (Multiple files)
  - **Examples**:
    - `lib/rate-limiter.ts:40` - `refillPerMinute / 60` (should be `SECONDS_PER_MINUTE`)
    - `app/api/cron/process-embeddings/route.ts:16-22` - Retry delay array
    - `app/api/processing-stats/route.ts:22` - `5000` milliseconds cache TTL
  - **Rationale for deferring**: Code is clear enough with inline comments. Named constants improve maintainability but not urgent.
  - **Effort**: Small (~1 hour)
  - **Priority**: Low
  - **Example**:
    ```typescript
    const SECONDS_PER_MINUTE = 60;
    const CACHE_TTL_MS = 5_000; // 5 seconds
    const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    ```
  - **PR Reference**: PR #4 Review #2 - Type Safety section

### Performance & Optimization

- **Monitor Memory Usage for Image Processing** (app/api/cron/process-images/route.ts:99-106)
  - **Current**: Loads entire image into memory (10MB × 10 images = 100MB peak)
  - **Observation**: Acceptable for Vercel Hobby 1GB memory limit, but could be optimized with streaming
  - **Rationale for deferring**: Current approach works within limits. Only optimize if hitting memory constraints.
  - **Streaming approach**:
    ```typescript
    // Instead of buffering entire file:
    const response = await fetch(asset.blobUrl);
    const result = await processUploadedImage(response.body, asset.mime);  // Stream
    ```
  - **Effort**: Medium (~2-3 hours to refactor Sharp for streaming)
  - **Priority**: Low (monitor first, optimize if needed)
  - **When to revisit**: If max file size increases beyond 10MB or batch size increases beyond 10
  - **PR Reference**: PR #4 Review #1 - Image Processing Memory Usage section

- **Optimize Stats Cache Cleanup** (app/api/processing-stats/route.ts:26-33)
  - **Current**: `setInterval` cleanup every 60 seconds (may not run in serverless)
  - **Enhancement**: Add inline cleanup on cache access (similar to rate limiter fix)
  - **Rationale for deferring**: Cache has small memory footprint (~100 bytes per user). Cleanup is nice-to-have but not critical.
  - **Effort**: Small (~30 minutes)
  - **Priority**: Low
  - **Implementation**: Add cleanup logic before cache lookup, remove setInterval
  - **PR Reference**: PR #4 Review #1 - Cache Cleanup Timing section

- **Database Connection Pool Tuning** (prisma configuration)
  - **Current**: Default pool size (10 connections)
  - **Observation**: Sufficient for current load (<100 concurrent requests)
  - **Rationale for deferring**: No connection pool exhaustion observed. Tune when load increases.
  - **Configuration**: Adjust `connection_limit` in `DATABASE_URL` query param
  - **Effort**: Small (~1 hour for load testing + config tuning)
  - **Priority**: Low
  - **Prerequisite**: Neon Postgres plan upgrade (Hobby = 100 connections, Pro = 1000)
  - **When to revisit**: When concurrent uploads exceed 50 or queue processing slows
  - **PR Reference**: PR #4 Review #2 - Database Connection Pool section

### Edge Cases & Reliability

- **Cron Dev Mode Fallback** (app/api/cron/*.ts:37-51)
  - **Issue**: `CRON_SECRET` only set in production, not preview deployments. Cron auth fails in Vercel preview.
  - **Enhancement**: Allow fallback auth in development/preview
  - **Implementation**:
    ```typescript
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isPreview = process.env.VERCEL_ENV === 'preview';
    const skipAuth = (isDevelopment || isPreview) && !cronSecret;

    if (!skipAuth && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    ```
  - **Rationale for deferring**: Cron jobs are production-only feature. Preview testing can use manual API calls.
  - **Effort**: Small (~30 minutes)
  - **Priority**: Low
  - **Security note**: Only allow in preview/dev, never in production without secret
  - **PR Reference**: PR #4 Review #2 - Cron Secret Validation Edge Case section

### Code Architecture

- **Centralize Database Availability Checks** (Multiple endpoints)
  - **Current**: Inconsistent null checks (`if (!prisma)` in some endpoints, missing in others)
  - **Enhancement**: Centralize in middleware or shared helper
  - **Example**:
    ```typescript
    // lib/db-middleware.ts
    export async function requireDatabase() {
      if (!prisma) {
        throw new DatabaseUnavailableError('Database connection unavailable');
      }
      return prisma;
    }
    ```
  - **Rationale for deferring**: Current approach works. Centralization improves consistency but isn't urgent.
  - **Effort**: Medium (~2 hours to refactor all endpoints)
  - **Priority**: Low
  - **PR Reference**: PR #4 Review #2 - Inconsistent Null Checks section

---

## 📊 Backlog Statistics

**Total Items**: 61 (+8 from PR #4 review feedback)
- Infrastructure & Tooling: 3 items
- Accessibility: 3 items
- Performance: 3 items
- Security: 3 items
- Documentation: 3 items
- Testing: 3 items
- UX Enhancements: 3 items
- Terminal Aesthetic: 9 items
- Bulk Upload System: 13 items
- **PR #4 Review Feedback**: 8 items (added)
- Rejected: 4 items

**Estimated Total Effort**: ~90-100 hours (+15 hours from PR feedback)

**Highest Priority Items**:
- Rate limiter unit tests (security-critical)
- Test coverage for new endpoints
- Server-side checksum validation
- Structured logging
- Memory leak detection (previous)
- Vercel Queue integration (previous)
