# TODO.md

## 🚨 Critical: Fix Search UX Component Remounting Issue

### Phase 1: Emergency Stabilization (Option 1 Quick Fix) ✅ COMPLETED
- [x] **Modify SearchBar to prevent URL updates during typing** - In `components/search/search-bar.tsx`, call onSearch with `updateUrl: false` in the debounced useEffect to prevent URL updates during typing while keeping search functionality active.
- [x] **Add updateUrl flag to onSearch callback signature** - Extended the SearchBar's onSearch prop type to accept `(query: string, options?: { updateUrl?: boolean }) => void` to allow callers to explicitly control when URL updates occur.
- [x] **Implement Enter-key-only URL updates** - In the handleSubmit and handleKeyDown functions, pass `{ updateUrl: true }` flag when calling onSearch on Enter key to explicitly trigger URL update only on form submission.
- [x] **Update handleInlineSearch in app/page.tsx** - Modified handleInlineSearch to use local state for immediate search updates and conditionally call updateUrlParams only when `options?.updateUrl === true`. Added `localSearchQuery` state and typing flag to prevent sync loops.

### Phase 2: Local State Implementation (Option 2 Recommended Fix) ✅ COMPLETED
- [x] **Add localSearchQuery state to app/page.tsx** - Added `const [localSearchQuery, setLocalSearchQuery] = useState<string>(queryParam)` to maintain search state independently of URL params, preventing remounts from URL changes.
- [x] **Create bidirectional sync between URL and local state** - Added useEffect that updates localSearchQuery when queryParam changes (for browser navigation), but NOT vice versa during typing using `isTypingRef.current` guard.
- [x] **Add typing flag to prevent sync loops** - Created `const isTypingRef = useRef<boolean>(false)` to track active typing state, set to true in handleInlineSearch, false after 1000ms of inactivity.
- [x] **Replace libraryQuery with localSearchQuery in useSearchAssets** - Set `const libraryQuery = localSearchQuery` to use local state instead of URL-derived state for search execution.
- [x] **Update SearchBar initialQuery prop** - Already passing `libraryQuery` (which equals `localSearchQuery`) to SearchBar component to maintain consistency.
- [x] **Add URL update on explicit search submission** - In handleInlineSearch, URL update only occurs when `options?.updateUrl === true` (Enter key press).

### Phase 3: Search Preview Dropdown (Option 5 Enhancement) ✅ COMPLETED
- [x] **Create SearchPreview component** - Built `components/search/search-preview.tsx` that renders a dropdown with top 5 results using absolute positioning, appearing below search bar during typing, similar to Google Instant.
- [x] **Add preview state management** - In SearchBar, added `showPreview`, `previewResults`, `selectedPreviewIndex`, and `previewTotalCount` state variables to manage dropdown visibility and content.
- [x] **Implement preview data fetching** - Created `useSearchPreview` hook that calls search API with `limit: 5` parameter, debounced to 300ms (faster than main search) with AbortController for request cancellation.
- [x] **Add click-outside handler** - Implemented click-outside detection in SearchPreview component that closes preview when user clicks anywhere outside search bar or preview dropdown.
- [x] **Style preview dropdown with result tiles** - Created mini version with 40x40px thumbnails, match percentage display, hover states, and selection highlighting.
- [x] **Add keyboard navigation to preview** - Implemented ArrowUp/ArrowDown navigation, Enter to select, Escape to close, with selectedPreviewIndex state tracking.
- [x] **Implement result selection handler** - Added `handleSelectPreviewResult` and `handleSeeAllResults` that trigger search with URL update and close preview.
- [x] **Add "See all X results" footer** - Implemented footer showing total count with "See all X results" link that triggers same behavior as Enter key.

### Phase 4: Performance Optimizations
- [x] **Add request cancellation to search** - Implemented AbortController in useSearchAssets to cancel in-flight requests when new search starts, preventing race conditions and wasted bandwidth.
- [x] **Implement search result caching** - Created SearchCache class with 5-minute TTL, LRU eviction, and automatic cleanup. Integrated into useSearchAssets and useSearchPreview hooks for instant cached results.
- [x] **Add optimistic UI updates** - Show skeleton loaders immediately on search start, replacing with actual results when ready, maintaining 60fps during transitions using CSS transforms instead of layout shifts.
- [~] **Debounce preview separately from main search** - Use 200ms debounce for preview (faster feedback) and keep 600ms for main search (fewer requests), balancing responsiveness with server load.

### Phase 5: User Education & Polish
- [ ] **Add search hints below input** - Display context-sensitive hints: "Type to search" when empty, "Press Enter to save search" while typing, "Press Escape to clear" when filled.
- [ ] **Implement search history** - Store last 10 searches in localStorage, show in dropdown when search bar focused but empty, with "Clear history" option for privacy.
- [ ] **Add visual feedback for search state** - Change border color: purple while typing, green when results found, yellow when no results, red on error, with smooth transitions.
- [ ] **Create keyboard shortcut (Cmd+K)** - Add global keyboard listener that focuses search bar when Cmd+K (Mac) or Ctrl+K (Windows/Linux) pressed, following industry standard.
- [ ] **Add search analytics tracking** - Log search queries, result counts, and click-through rates to identify common searches and improve relevance algorithm over time.

### Phase 6: Testing & Validation
- [ ] **Test search with 1-character query** - Verify single character searches don't cause remounts or errors, especially Unicode characters and emoji.
- [ ] **Test rapid typing (100+ WPM)** - Ensure no character drops, UI freezes, or component remounts when typing quickly, simulating power users.
- [ ] **Test browser back/forward navigation** - Verify search state correctly restored from URL params when using browser navigation, maintaining expected behavior.
- [ ] **Test search with 1000+ results** - Ensure performance remains smooth with large result sets, virtual scrolling works correctly, no memory leaks.
- [ ] **Test network interruption during search** - Verify graceful error handling when network fails mid-search, with appropriate error messages and retry capability.
- [ ] **Test search on mobile devices** - Ensure touch interactions work correctly, keyboard doesn't cover results, and performance acceptable on lower-powered devices.

### Phase 7: Future Enhancements (Low Priority)
- [ ] **Consider Command Palette implementation** - Research libraries like cmdk or kbar for full Cmd+K experience, evaluating bundle size impact and customization options.
- [ ] **Evaluate moving search to layout.tsx** - Assess architectural change to prevent search bar remounts entirely by lifting state above page components.
- [ ] **Add search filters UI** - Design and implement filter chips for file type, date range, favorites, tags to refine searches without additional queries.
- [ ] **Implement search suggestions** - Use popular searches and user history to suggest completions while typing, similar to Google's autocomplete.
- [ ] **Add advanced search syntax** - Support operators like "tag:memes", "before:2024", "type:gif" for power users, with documentation and examples.

## 📊 Success Metrics
- Search input never clears unexpectedly during typing
- URL updates only on explicit user action (Enter key)
- Search results appear within 200ms of typing pause
- Zero component remounts during search interaction
- Search state persists across navigation when appropriate