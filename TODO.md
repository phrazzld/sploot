# TODO: Bloomberg Terminal × Linear Aesthetic Redesign

> **Objective**: Transform Sploot into a high-density, information-rich "meme intelligence operations" interface inspired by Bloomberg Terminal and Linear's minimal visual language. Treating meme collection with tactical seriousness creates delightful cognitive dissonance while improving information density and usability.

---

## Phase 1: Foundation (Core Visual Identity)

### Color System & Typography

- [x] **Replace dark mode background with pure black** - Update `app/globals.css` line 17 from `--background: #0a0a0a;` to `--background: #000000;`. Success criteria: All dark mode surfaces use pure black, verified in DevTools computed styles.

- [x] **Add JetBrains Mono font for metadata display** - Import `JetBrains_Mono` from `next/font/google` in `app/layout.tsx` alongside existing Geist fonts. Add CSS variable `--font-jetbrains-mono` to `@theme inline` block in `globals.css`. Success criteria: Font loads without FOUT, available as Tailwind `font-mono` utility.

- [x] **Define terminal color system in CSS custom properties** - Add to `globals.css` `:root` block: `--color-terminal-green: #4ADE80`, `--color-terminal-red: #EF4444`, `--color-terminal-yellow: #FBBF24`, `--color-terminal-gray: #888888`. Success criteria: Colors accessible via `text-[var(--color-terminal-green)]` in components.

- [x] **Remove Lime Pop accent color from design system** - Search codebase for `#BAFF39` references and replace with `#4ADE80` (terminal green) or context-appropriate color. Update CLAUDE.md color documentation. Success criteria: Zero references to Lime Pop, verified via `grep -r "BAFF39"`.

- [x] **Update theme color metadata to pure black** - Change `themeColor` in `app/layout.tsx` viewport config from `#7C5CFF` to `#000000`. Update manifest theme_color and msapplication-TileColor. Success criteria: Browser chrome shows black background on mobile.

### Layout & Chrome

- [x] **Add corner bracket SVG component for viewport framing** - Create `components/chrome/corner-brackets.tsx` with four SVG corner brackets (top-left, top-right, bottom-left, bottom-right). Each bracket: 24px × 24px, 2px stroke, `#888888` color, positioned absolutely. Success criteria: Brackets frame main content area without overlapping scrollbars.

- [x] **Integrate corner brackets into AppChrome layout** - Import and render `<CornerBrackets />` in `components/chrome/app-chrome.tsx` as fixed overlay. Position using `fixed` with 8px inset from viewport edges. Success criteria: Brackets visible on all pages, stay fixed during scroll.

- [x] **Update navbar background to pure black with subtle border** - Change `components/chrome/navbar.tsx` line 39 from `bg-[#14171A]` to `bg-black`. Update border color from `border-[#2A2F37]` to `border-[#1A1A1A]` for ultra-subtle separation. Success criteria: Navbar seamlessly blends with pure black background.

- [x] **Convert stats display to monospace typography** - Update `components/chrome/stats-display.tsx` to use `font-mono` class instead of default font. Change format from "134 memes • 2 bangers • 9.9 MB" to terminal-style "247 ASSETS | 843MB | LAST SYNC: 2025-06-17T14:23". Success criteria: Stats use JetBrains Mono, ISO 8601 timestamps, pipe separators.

### Grid Density

- [x] **Increase default grid columns for dense view** - Update grid configuration to show 6 columns on desktop (1440px+), 4 on tablet (768px+), 2 on mobile. Modify grid gap from current value to 8px for tighter spacing. Success criteria: 6-8 memes visible on laptop screen without scrolling.

- [x] **Add grid density toggle to view options** - Create density options: "Compact" (8 columns, 4px gap), "Dense" (6 columns, 8px gap - default), "Comfortable" (4 columns, 16px gap). Store preference in URL params. Success criteria: User can toggle between densities, preference persists in URL.

- [x] **Update image tile hover states for dense grid** - Reduce padding/margins in `image-tile.tsx` hover overlay. Decrease metadata font size to `text-xs` (12px). Ensure hover states don't cause layout shift in tight grid. Success criteria: Hover overlay readable at dense spacing, no CLS.

---

## Phase 2: Intelligence Layer (Data-Driven UI)

### Search & Similarity Scoring

- [x] **Add confidence score overlay to search result tiles** - When search is active, display similarity score in top-right corner of each image tile. Format: monospace, 2 decimal places (e.g., "0.94"), `font-mono text-xs`. Success criteria: Scores appear only during search, positioned absolutely, don't obscure image content.

- [x] **Implement color coding based on similarity scores** - Add border color to image tiles based on score: `>0.85` = terminal green, `0.7-0.85` = terminal yellow, `<0.7` = white/default. Border: 2px solid, subtle glow effect. Success criteria: High-confidence results visually distinct, accessible color contrast.

- [x] **Create similarity score legend component** - Add small legend to search results header explaining color system: "Green: High match (>85%) • Yellow: Medium (70-85%) • White: Standard". Dismissible, stores preference in localStorage. Success criteria: Legend shows on first search, can be dismissed, explains color coding.

### Status Line & Monitoring

- [x] **Create terminal-style status line component** - New component `components/chrome/status-line.tsx` showing: asset count, storage usage, last upload timestamp (ISO 8601), processing queue depth. Monospace, `text-xs`, positioned top-right of navbar. Success criteria: Real-time updates, monospace formatting, unobtrusive positioning.

- [x] **Add real-time stats to status line** - Connect status line to asset count, total size calculation, and upload queue status. Update every 500ms when queue is active, every 5s when idle. Success criteria: Stats update without re-render thrashing, accurate within 1 second.

- [x] **Implement processing state indicators** - Update upload flow to show terminal-style messages: `[PROCESSING] Generating embeddings...`, `[COMPLETE] Indexed: drake_001.jpg`, `[ERROR] Upload failed: file exceeds 10MB`. Monospace, color-coded by state. Success criteria: Messages appear in toast/banner, clear terminal aesthetic.

### Metadata & Timestamps

- [x] **Convert all timestamps to ISO 8601 format** - Find all timestamp displays (upload time, last modified, etc.) and convert to `2025-06-17T14:23:45Z` format. Use monospace font. Success criteria: Consistent timestamp format across app, verified via visual audit.

- [x] **Add monospace formatting to file metadata** - Display filename, dimensions, file size in monospace. Format: `drake_meme.jpg | 1920×1080 | 2.4MB`. Success criteria: Metadata uses JetBrains Mono, aligned columns in lists.

- [x] **Show file processing status with terminal syntax** - When hover over image, show processing status: `[✓] EMBEDDED`, `[⏳] QUEUED`, `[✗] FAILED`. Monospace, color-coded (green check, yellow hourglass, red X). Success criteria: Status visible on hover, clear at-a-glance processing state.

---

## Phase 3: Power User Features

### Command Palette & Shortcuts

- [x] **Add terminal-style command palette theme** - Update `components/chrome/command-palette.tsx` with monospace font, pure black background, terminal green highlights. Commands prefixed with `>` like VS Code. Success criteria: Palette matches terminal aesthetic, keyboard nav preserved.

- [x] **Extend command palette with density commands** - Add commands: `> Set Density: Compact`, `> Set Density: Dense`, `> Set Density: Comfortable`. Also add `> Show Confidence Scores` toggle. Success criteria: Commands functional, affect view immediately.

- [x] **Document keyboard shortcuts in terminal style** - Update shortcuts display (⌘K help) with monospace layout. Format: `⌘ + K → Command Palette`, `/ → Search`, `1-3 → Density`. Success criteria: Help modal uses monospace, aligned columns.

### Advanced Filtering & Search

- [ ] **Add search query syntax indicators** - When user searches, show parsed query in terminal syntax: `QUERY: "drake meme" | FILTERS: [favorites] | RESULTS: 23`. Monospace, positioned below search bar. Success criteria: Query breakdown visible, helps users understand search.

- [ ] **Implement search performance metrics** - Show search latency in monospace: `Search completed in 0.89s`. Position near search results count. Success criteria: Accurate timing, updates per search, monospace format.

- [ ] **Add advanced filter UI with terminal aesthetic** - Create filter panel with monospace labels: `[ ] FAVORITES ONLY`, `[ ] HAS EMBEDDING`, `DATE RANGE: [____] TO [____]`. Checkbox/input styling matches terminal. Success criteria: Filters functional, clear terminal aesthetic.

### View Modes & Preferences

- [ ] **Create view mode indicator in status line** - Add current view mode to status line: `VIEW: DENSE GRID | SORT: RELEVANCE`. Monospace, clickable to change. Success criteria: Always visible, clear current state.

- [ ] **Add density preference to URL state** - Extend URL params to include `density=compact|dense|comfortable`. Sync with view mode and sort params. Success criteria: Density persists in URL, shareable links preserve density.

- [ ] **Implement smooth transitions between density modes** - When changing density, animate grid reconfiguration over 200ms. Use CSS Grid `transition: grid-template-columns 200ms`. Success criteria: Smooth transition, no jank, 60fps.

---

## Testing & Validation

- [ ] **Create visual regression test for terminal aesthetic** - Add Playwright test capturing screenshots of: navbar, grid at all densities, search results with scores, command palette. Compare against baseline. Success criteria: Automated visual regression detection.

- [ ] **Verify color contrast meets WCAG AA** - Test all terminal colors (green, red, yellow, gray) on black background. Ensure text contrast ≥4.5:1. Success criteria: All color combinations pass WebAIM contrast checker.

- [ ] **Test monospace alignment across browsers** - Verify JetBrains Mono renders consistently in Chrome, Safari, Firefox. Check alignment in stats line, timestamps, file metadata. Success criteria: No alignment issues, font loads reliably.

- [ ] **Performance test with dense grid (1000+ images)** - Load 1000 images in compact mode. Measure: initial render time, scroll FPS, memory usage. Ensure <2s render, 60fps scroll. Success criteria: Dense mode performs well at scale.

- [ ] **Audit keyboard navigation with new UI** - Test all keyboard shortcuts with terminal-styled components. Verify focus indicators visible on black background. Success criteria: All shortcuts work, focus rings visible.

---

## Documentation Updates

- [ ] **Update AESTHETIC.md with Bloomberg Terminal direction** - Document terminal color system, typography rules (when to use monospace vs sans), corner bracket usage, density guidelines. Success criteria: Clear guidelines for future development.

- [ ] **Update CLAUDE.md design system section** - Replace "Crisp Lab Minimal" with "Bloomberg Terminal × Linear" aesthetic. Document new color palette, remove Lime Pop. Success criteria: CLAUDE.md reflects current design direction.

- [ ] **Create component documentation for terminal elements** - Document `CornerBrackets`, `StatusLine`, terminal-styled `CommandPalette`. Include usage examples, props, styling guidelines. Success criteria: Developers can implement new features matching aesthetic.

---

## Future Enhancements (Move to BACKLOG.md)

These are out of scope for initial implementation but valuable future improvements:

- **Animated CRT scan line effect** (optional, could be too much)
- **Sound effects for upload/search** (terminal beeps)
- **Heat map visualization of search clusters** (advanced analytics)
- **Multi-column list view** (Bloomberg-style data tables)
- **Customizable status line metrics** (user chooses what to display)
- **Terminal color theme variants** (amber, green, blue phosphor themes)

---

**Total Tasks**: 41 core implementation tasks
**Estimated Effort**: ~20-25 hours (assuming parallel development)
**Priority Order**: Phase 1 → Phase 2 → Phase 3 (each phase builds on previous)
