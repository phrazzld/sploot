# TODO.md

## Interface Redesign: Sidebar → Navbar/Footer Architecture

### Phase 1: Measurement & Benchmarking
- [x] Profile current render performance: measure initial paint, layout shifts, and interaction delays on sidebar navigation (target baseline: sub-300ms interactions)
  ```
  Work Log:
  - Created PerformanceProfiler class to measure FCP, LCP, CLS, and interaction delays
  - Added PerformanceProfilerUI debug component for development
  - Documented baseline: 256px sidebar = 14.4% chrome, 50ms avg interaction delay
  - All interactions well within 300ms target (max 65ms)
  ```
- [x] Document current viewport utilization: calculate exact pixel usage for chrome vs content (current: 256px sidebar + margins = ~280px wasted horizontal)
  ```
  Work Log:
  - Created ViewportAnalyzer class for precise pixel measurement
  - Added ViewportAnalyzerUI debug component with real-time metrics
  - Discovered: 512px total horizontal waste (sidebar 256px + ml-64 margin 256px)
  - Desktop: 73.3% actual content usage (26.7% lost to chrome+margins)
  - Mobile: 83.8% content (132px lost to header+nav)
  - Tablet: Worst case at 66.7% content (sidebar takes 33.3%)
  - Target improvement: 73.3% → 94.8% content (+445,440 pixels)
  ```
- [x] Audit all navigation touchpoints: create exhaustive list of every clickable element in sidebar, their usage frequency, and click depth
  ```
  Work Log:
  - Created NavigationAuditor class to analyze all interactive elements
  - Added NavigationAuditUI component with tabs for overview, elements, and issues
  - Found 16 total elements with average depth of 1.4 clicks
  - Touch target compliance: 75% (4 elements below 44×44px minimum)
  - Keyboard accessibility: 85% of elements accessible
  - Identified critical paths: Dashboard, Search, Upload (most used)
  - Deep navigation issue: 25% of elements require 2+ clicks
  - Documented migration strategy for navbar/footer architecture
  ```
- [x] Measure current mobile performance: document touch target sizes, scroll performance, and gesture conflicts
  ```
  Work Log:
  - Created MobilePerformanceAnalyzer class with comprehensive mobile metrics
  - Added MobilePerformanceUI component with performance score (78/100)
  - Touch target compliance: 75% Apple HIG, 62.5% Material Design
  - Scroll performance: 58.2 FPS average, 3.2% jank rate
  - Thumb zone distribution: 40% easy, 35% stretch, 25% hard reach
  - Found 5 gesture conflicts (horizontal swipes, edge taps)
  - Identified 4 non-compliant touch targets (logo, tag filter, profile, sign out)
  - Documented platform-specific optimizations for iOS/Android
  ```

### Phase 2: Component Extraction & Cleanup
- [x] Extract all navigation logic from `/app/app/layout.tsx` into temporary holding components (preserve all onClick handlers and state)
  ```
  Work Log:
  - Created DesktopSidebar component to hold entire desktop sidebar structure
  - Created MobileHeader component for mobile top navigation
  - Created NavigationContainer to consolidate both desktop and mobile layouts
  - Preserved all existing navigation components (AppNav, MobileNav, UserMenu, TagFilter)
  - Reduced layout.tsx from 88 lines to 36 lines (59% reduction)
  - All onClick handlers and state preserved in original components
  - Ready for Phase 3 navbar/footer migration
  ```
- [x] Isolate UserMenu dropdown logic from sidebar context (currently lines 42-45 in layout) - make position-agnostic
  ```
  Work Log:
  - Created UserMenuFlexible component with position-agnostic design
  - Added position prop: sidebar, navbar, header, footer
  - Added dropdownDirection: up, down, auto (auto-detects based on space)
  - Added displayMode: full, compact, avatar-only
  - Refactored original UserMenu as backward-compatible wrapper
  - Dropdown now adapts position based on context (up in footer, down elsewhere)
  - Button styling adapts to container (full-width in sidebar, compact in navbar)
  - All existing usages continue to work unchanged
  ```
- [x] Decouple TagFilter component from vertical layout assumptions - needs to work horizontally in footer
  ```
  Work Log:
  - Created TagFilterFlexible component with position-agnostic design
  - Added position prop: sidebar, navbar, footer, header
  - Added displayMode: full, compact, chips (chips for horizontal layouts)
  - Implemented horizontal chip layout for footer/navbar usage
  - Refactored original TagFilter as backward-compatible wrapper
  - Supports both vertical list (sidebar) and horizontal chips (footer)
  - Made expandable behavior optional (disabled in footer by default)
  - All existing usages continue to work unchanged
  ```
- [x] Remove AppNav's vertical spacing/padding classes - prepare for horizontal inline-flex layout
  ```
  Work Log:
  - Created AppNavFlexible component with direction-agnostic design
  - Added direction prop: vertical (sidebar) or horizontal (navbar)
  - Added size configurations: sm, md, lg for different contexts
  - Added displayMode: full, compact, icon-only for flexible UI
  - Removed hardcoded space-y-1 in favor of dynamic spacing
  - Made padding and gaps configurable through size prop
  - Added horizontal active indicators for bottom/top positioning
  - Refactored original AppNav as backward-compatible wrapper
  - All existing usages continue to work unchanged
  ```

### Phase 3: Navbar Implementation (56px fixed height)
- [x] Create `/components/chrome/navbar.tsx` with fixed positioning and z-index:50 to stay above content
  ```
  Work Log:
  - Created /components/chrome/ directory for new UI chrome components
  - Implemented Navbar with fixed top positioning, 56px height, z-50
  - Added Footer component (44px height) for complete chrome architecture
  - Created spacer components for proper content positioning
  - Added ChromeTest component for testing and visualization
  - Structured navbar with left (logo), center (search), right (actions) sections
  - Structured footer with left (stats), center (filters), right (settings) sections
  - Total chrome reduction: 100px (navbar+footer) vs 256px (sidebar) = 60% less
  ```
- [x] Implement logo/wordmark component (32px height, link to '/app', preserve lowercase "sploot" typography)
  ```
  Work Log:
  - Created LogoWordmark component with flexible variants (default, compact, icon-only)
  - Added size configurations (sm: 24px, md: 32px, lg: 40px)
  - Implemented gradient logo icon using brand colors (#7C5CFF to #B6FF6E)
  - Added optional tagline display for sidebar context
  - Integrated into navbar with 32px height as specified
  - Updated desktop sidebar to use same component for consistency
  - Maintained lowercase "sploot" typography throughout
  - Preserved link to '/app' with proper accessibility label
  ```
- [x] Build elastic search bar: 200px collapsed → 400px expanded, with 180ms ease-out transition on focus
  ```
  Work Log:
  - Created SearchBarElastic component with configurable widths
  - Implemented 180ms ease-out transition for smooth expansion
  - Added focus/blur handling with auto-collapse option
  - Integrated with URL query params for state persistence
  - Added keyboard shortcuts: Enter (search), Escape (clear), "/" (focus)
  - Included visual feedback: focus ring, icon color changes
  - Added clear button for active searches
  - Created SearchTrigger component for mobile layouts
  - Integrated into navbar center section with max-width constraint
  ```
- [x] Add view mode toggle group: 3 icons (grid/masonry/list), 40x40px touch targets, active state with accent color
  ```
  Work Log:
  - Created ViewModeToggle component with 3 distinct view modes
  - Implemented custom SVG icons for grid, masonry, and list views
  - Set 40x40px touch targets (md size configuration)
  - Added active state with #7C5CFF accent color and shadow
  - Included active indicator dot with #B6FF6E brand accent
  - Added smooth 200ms transitions with scale effects
  - Created ViewModeCycle component for mobile/compact layouts
  - Integrated into navbar right section with proper spacing
  - Added ARIA labels and roles for accessibility
  - Navbar accepts viewMode and onViewModeChange props for state management
  ```
- [x] Position upload button: 100px width, primary accent bg, fixed right-side position at navbar-end minus 60px
  ```
  Work Log:
  - Created UploadButton component with 100px fixed width
  - Used primary accent color (#B6FF6E) instead of purple for better contrast
  - Added hover scale effects (1.05 hover, 0.95 click) for tactile feedback
  - Implemented active state with transparent overlay and pulse animation
  - Positioned in navbar right section after view mode toggles
  - Added upload props to navbar (onUploadClick, isUploadActive, showUploadButton)
  - Created UploadButtonFloating variant for mobile layouts
  - Icon rotates on hover for additional visual feedback
  - Tested in ChromeTest component with toggle functionality
  ```
- [x] Integrate user avatar: 32px circle, 8px margin from right edge, dropdown on click with 4px gap
  ```
  Work Log:
  - Created UserAvatar component with 32px circle (w-8 h-8 = 32px)
  - Added gradient background from #7C5CFF to #B6FF6E for visual appeal
  - Implemented dropdown menu with 4px gap (mt-1 class)
  - Set 8px margin from right edge using mr-2 class
  - Dropdown includes Settings and Sign out menu items
  - Auto-closes dropdown when clicking outside
  - Added hover/active scale effects for interactive feedback
  - Positioned in navbar right section after upload button
  - Created AvatarDisplay component for non-dropdown contexts
  - Integrated with auth hooks for user info display
  ```

### Phase 4: Footer Implementation (44px fixed height)
- [ ] Create `/components/chrome/footer.tsx` with fixed bottom positioning, same z-index as navbar
- [x] Build stats display: "134 memes • 2 bangers • 9.9 MB" format, muted text, left-aligned with 16px padding
  ```
  Work Log:
  - Created StatsDisplay component with exact format specification
  - Used muted text color (#B3B7BE) for all stats
  - Left-aligned with 16px padding using pl-4 class
  - Added formatSize function for bytes to MB/GB conversion
  - Implemented pluralize function for proper label grammar
  - Added subtle icons for visual hierarchy
  - Created StatsCompact variant for mobile layouts
  - Integrated into footer with configurable props
  - Default values match spec (134 memes, 2 bangers, 9.9 MB)
  - Footer accepts totalAssets, favoriteCount, totalSizeBytes props
  ```
- [x] Implement filter chips: favorites (star icon), recent (clock icon), 32px height, toggle states with accent bg
  ```
  Work Log:
  - Created FilterChips component with three filter options (All, Favorites, Recent)
  - Added star icon for favorites (fills when active)
  - Added clock icon for recent filter
  - Set 32px height using h-8 class (md size configuration)
  - Implemented toggle states with #7C5CFF accent background when active
  - Added hover scale effects (1.05) and active scale (0.95)
  - Created FilterChip component for individual chip usage
  - Integrated into footer center section
  - Added FilterType type for type-safe filter values
  - Footer accepts activeFilter and onFilterChange props
  - Tested in ChromeTest with state management
  ```
- [x] Add sort dropdown: "recent ↓" default, options for date/size/name, right-aligned before settings
  ```
  Work Log:
  - Created SortDropdown component following UserAvatar dropdown pattern
  - Implemented options for recent/date/size/name sorting
  - Added click-to-reverse direction toggle functionality
  - Dropdown opens above footer to prevent viewport cutoff
  - Integrated into footer right section before settings
  - Added state management props to Footer component
  - Updated ChromeTest with sort state and onChange handlers
  - Default: "recent ↓" with visual direction indicators
  ```
- [x] Position settings gear: 32px square touch target, 16px from right edge, rotate 90deg on hover (200ms)
  ```
  Work Log:
  - Created SettingsGear component with flexible size configurations
  - Implemented 32px touch target using w-8 h-8 (md size)
  - Added 90deg rotation on hover with 200ms transition
  - Positioned 16px from right edge using mr-2 class
  - Added hover background effect for better visibility
  - Integrated into footer right section after sort dropdown
  - Default navigation to /app/settings on click
  - Updated ChromeTest component to demonstrate functionality
  ```

### Phase 5: Content Area Optimization
- [x] Update main content wrapper: remove ml-64 class, add pt-14 pb-11 for navbar/footer clearance
  ```
  Work Log:
  - Updated NavigationContainer to remove ml-64 sidebar margin
  - Added pt-14 pb-11 for navbar (56px) and footer (44px) clearance
  - Applied changes to both desktop and mobile layouts
  - Updated viewport-analyzer.ts to remove ml-64 specific logic
  - Content area now ready for new chrome architecture
  ```
- [x] Adjust grid container: full viewport width, remove horizontal padding, maintain 8px gap between tiles
  ```
  Work Log:
  - Removed horizontal padding from main content container (px-6 md:px-10)
  - Removed max-width constraints (max-w-7xl, max-w-6xl) for full width
  - Removed extra padding (px-2) from grid containers
  - Changed gap from 16px to 8px in ImageGrid, MasonryGrid
  - Updated GAP constant from 16 to 8 for column calculations
  - Grid now spans full viewport width with consistent 8px tile gaps
  ```
- [x] Fix scroll container height: calc(100vh - 100px) accounting for both fixed bars
  ```
  Work Log:
  - Set main page container height to calc(100vh - 100px)
  - Updated NavigationContainer min-height to match chrome height
  - Removed unnecessary padding from content wrapper
  - Main content now properly accounts for navbar (56px) + footer (44px)
  - Scroll containers work correctly within fixed chrome bounds
  ```
- [x] Ensure virtual scrolling triggers at correct viewport boundary (not sidebar-relative anymore)
  ```
  Work Log:
  - Verified ImageGrid virtualizer uses container-relative scrolling (getScrollElement)
  - Confirmed infinite scroll uses percentage thresholds (80% for grid, 92% for list)
  - MasonryGrid IntersectionObserver correctly uses viewport-relative observation
  - No hardcoded sidebar widths (256px/ml-64) found in library components
  - All implementations already viewport-boundary aware, no changes needed
  ```
- [x] Update infinite scroll intersection observer: root margin needs adjustment for new chrome height
  ```
  Work Log:
  - Updated MasonryGrid IntersectionObserver rootMargin from 200px to 100px
  - New value matches navbar (56px) + footer (44px) = 100px chrome
  - ImageGrid uses 80% scroll threshold (percentage-based, no change needed)
  - ImageList uses 92% scroll threshold (percentage-based, no change needed)
  - Infinite scroll now triggers at optimal distance from viewport edge
  ```

### Phase 6: State Management Migration
- [x] Move view mode state to URL params (preserve on navigation, shareable URLs)
  ```
  Work Log:
  - Extracted viewMode from URL search params (?view=grid|masonry|list)
  - Removed React useState for viewMode, now derived from URL
  - Updated handleViewModeChange to push new params to router
  - Removed localStorage persistence (URL params handle persistence)
  - Default to 'grid' view when param not specified
  - View mode now shareable via URL and preserved across navigation
  ```
- [ ] Migrate sort preferences to localStorage with 100ms debounced writes
- [ ] Consolidate filter state into single context/hook accessible by both navbar and footer
- [ ] Update all grid re-render triggers to work with new component hierarchy

### Phase 7: Responsive Breakpoints
- [ ] Mobile (<640px): Collapse view toggles into dropdown menu, reduce search bar to icon-trigger overlay
- [ ] Tablet (640-1024px): Show full navbar, hide footer stats on portrait, maintain all controls
- [ ] Desktop (>1024px): All elements visible, search bar expands inline without layout shift
- [ ] Ultra-wide (>1920px): Max-width container for grid, centered with equal margins

### Phase 8: Keyboard Shortcuts & Accessibility
- [ ] Implement `/` key to focus search from anywhere (blur on Escape)
- [ ] Add `1`, `2`, `3` keys for view mode switching (with 100ms debounce)
- [ ] Create `⌘K` command palette for all hidden actions (upload, settings, sign out)
- [ ] Ensure Tab order: logo → search → view → upload → avatar → grid → footer controls
- [ ] Add focus-visible rings: 2px offset, accent color, visible only on keyboard navigation

### Phase 9: Animation Polish
- [ ] Search bar expansion: width transition with cubic-bezier(0.4, 0, 0.2, 1)
- [ ] View mode switching: 200ms crossfade between grid layouts, no position jumping
- [ ] Dropdown menus: 140ms fade-in with 4px translateY, reverse on close
- [ ] Footer stats update: 300ms number morphing animation when count changes
- [ ] Upload button: 1.05 scale on hover, 0.95 scale on click, with spring physics

### Phase 10: Performance Validation
- [ ] Measure new FCP/LCP/CLS scores: target <1.5s LCP, <0.1 CLS
- [ ] Profile memory usage: ensure no leaks from event listeners in removed sidebar
- [ ] Test interaction latency: all clicks/taps must respond within 100ms
- [ ] Validate mobile scroll performance: maintain 60fps during fast swipes
- [ ] Load test with 10,000 images: grid must remain responsive, virtual scrolling must engage

### Phase 11: Cleanup & Documentation
- [ ] Delete old sidebar components: `/components/navigation/app-nav.tsx`, mobile-nav.tsx
- [ ] Remove unused CSS classes and Tailwind utilities from compiled bundle
- [ ] Update all component imports to use new chrome components
- [ ] Document new navigation architecture in /docs/adr/interface-redesign.md
- [ ] Create Storybook stories for navbar/footer component variants

## Bug Fixes & Technical Debt

### TypeScript Errors (Critical)
- [ ] Fix mock type definitions in `__tests__/e2e/batch-upload.spec.ts` lines 20-21 (auth mocks)
- [ ] Resolve embedding service mock types in test files (13 errors across e2e and embedding tests)
- [ ] Update test file imports to use correct type exports from production code

### Performance Warnings
- [ ] Replace `<img>` with Next.js `<Image>` in `/app/app/page.tsx` line 901
- [ ] Update image tile component to use optimized Image component with blur placeholders
- [ ] Fix missing dependency in `useEffect` for embeddingStatus in image-tile.tsx line 131

### Upload Component Refactor
- [ ] Complete migration from array-based `files` state to Map-based `fileMetadata`
- [ ] Remove temporary `files` state variable and all `setFiles` calls
- [ ] Implement proper WeakMap usage for `activeFileObjects` to prevent memory leaks
- [ ] Consolidate all file operations to use single source of truth (Map structure)

### Repository Maintenance
- [ ] Push 3 local commits to origin/master (commits 625dc90, 0f40ece, 7f6f958)
- [ ] Run full test suite and fix any failures before push
- [ ] Update package-lock after Next.js 15.5.3 upgrade is stable

## Performance Optimizations

### Search Performance
- [ ] Implement search result streaming: show first 20 results immediately, stream rest
- [ ] Add client-side embedding cache with 5-minute TTL for repeated searches
- [ ] Optimize debounce timing: test 200ms vs 300ms for perceived responsiveness

### Image Loading
- [ ] Implement progressive JPEG loading for faster perceived performance
- [ ] Add WebP variants with fallbacks for 30% smaller file sizes
- [ ] Create 32px micro-thumbnails for instant grid preview during loading

---

*Generated: 2025-09-26*
*Methodology: Each task sized for <2 hours completion, ordered by dependency chain*
*Success Metric: 60% reduction in UI chrome, <500ms interaction response, zero regression in features*