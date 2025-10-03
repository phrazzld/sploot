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

## ♿ Accessibility

### Keyboard Navigation

- **Implement focus trap management** - Add focus trap to modal components (CommandPalette, DeleteConfirmationModal) using `react-focus-lock` or manual implementation. Ensure Tab cycles within modal and Escape returns focus to trigger element.
  - **Rationale for deferring**: Basic keyboard nav works; this improves experience but isn't blocking
  - **Effort**: Medium (~2 hours)
  - **Priority**: Medium
  - **Library option**: `npm install react-focus-lock`
  - **PR Reference**: Multiple accessibility suggestions in reviews

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

### React Optimizations

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

- **Validate URL parameters for view modes** - Currently view mode and filter params from URL are trusted. Add validation to ensure values match expected enum (grid/list, specific tag IDs exist, etc.) to prevent XSS via crafted URLs.
  - **Rationale for deferring**: Next.js sanitizes URLs; additional validation is belt-and-suspenders
  - **Effort**: Small (~30 min)
  - **Priority**: Very Low
  - **Implementation**: Zod schema validation in page component
  - **PR Reference**: Mentioned in security considerations section

## 📚 Documentation

### Architecture Documentation

- **Document new chrome architecture in CLAUDE.md** - Update the Architecture section in `CLAUDE.md` to explain the navbar/footer design decision, component hierarchy, state management via FilterContext, and URL-driven view state. Include diagram if possible.
  - **Rationale for deferring**: Code is self-documenting for now; comprehensive docs can come later
  - **Effort**: Medium (~1-2 hours for thorough documentation)
  - **Priority**: Medium
  - **Include**: Decision rationale, component relationships, state flow diagram
  - **PR Reference**: Multiple reviews noted this should be documented

- **Create keyboard shortcuts reference modal** - Add a help modal (triggered by `?` key) that displays all keyboard shortcuts: ⌘K (command palette), / (search), 1 (grid view), 2 (list view), Escape (clear/close), etc. Use CommandPalette pattern.
  - **Rationale for deferring**: Power users will discover shortcuts; modal is nice-to-have
  - **Effort**: Small (~1-2 hours)
  - **Priority**: Low
  - **Design**: Use same styling as CommandPalette for consistency
  - **PR Reference**: Multiple reviews suggested documenting shortcuts

### API Documentation

- **Document cron job schedules in Vercel** - Ensure `vercel.json` cron schedules are documented. Add comments explaining the schedule expressions and what each job does. Add to CLAUDE.md Operations section.
  - **Rationale for deferring**: Cron jobs exist and work; documentation improves maintainability
  - **Effort**: Small (~15 min)
  - **Priority**: Low
  - **PR Reference**: Mentioned as missing validation

## 🧪 Testing Enhancements

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

## 🚫 Rejected / Not Applicable

### Won't Do

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

## 📊 Backlog Statistics

**Total Items**: 40
- Infrastructure & Tooling: 3 items
- Accessibility: 3 items
- Performance: 3 items
- Security: 3 items
- Documentation: 3 items
- Testing: 3 items
- UX Enhancements: 3 items
- Terminal Aesthetic: 9 items
- Rejected: 4 items

**Estimated Total Effort**: ~45-50 hours
**Highest Priority Items**: Memory leak detection, rate limiting, architecture documentation, multi-column list view
