# TODO: shadcn/ui Migration

## Status: Phase 4 Complete ✅ | Phase 5 In Progress

**Current Focus**: Polish & Hardening (accessibility, responsive design, performance, cleanup)

---

## ✅ Completed Phases (Summary)

<details>
<summary><strong>Phase 1: Foundation Setup</strong> (6 tasks) - Commits: 54596c6, 88d5e2e, c3b1b72, 4f44b21, 8b6be75, 30f4cc1, 15074f4, 5880ff2, 8e4c76e</summary>

- [x] Initialize shadcn/ui configuration and MCP server
- [x] Install 19 core primitive components (Button, Input, Card, Dialog, Badge, etc.)
- [x] Migrate design tokens (replaced terminal colors with shadcn semantic colors)
- [x] Remove custom animations (replaced with tailwindcss-animate)
- [x] Update font configuration (Geist Sans + JetBrains Mono)
- [x] Verify Tailwind CSS v4 compatibility

**Deliverable**: shadcn/ui infrastructure ready, 19 primitives installed, design tokens migrated.
</details>

<details>
<summary><strong>Phase 2: Core UI Components</strong> (11 tasks) - Latest: dd8f63a</summary>

- [x] Migrate Navbar to shadcn tokens (004694e)
- [x] Implement theme toggle with next-themes (6291dd5)
- [x] Migrate UserAvatar to Avatar + DropdownMenu (58642f3)
- [x] Simplify LogoWordmark (452c612)
- [x] Rebuild SearchBar with Input + Badge (8068a99)
- [x] Rebuild CommandPalette with Command primitive (23a8cc7)
- [x] Create SearchOverlay with Dialog + Command (dd8f63a)
- [x] Rebuild SortDropdown with DropdownMenu (652f0af)
- [x] Replace FilterChips with Button variants (ca16c9b)
- [x] Migrate ViewModeToggle to Button group (93043e1)
- [x] Create KeyboardShortcutsHelp with Dialog (c7c3f20)

**Deliverable**: Navigation, search, and chrome rebuilt with shadcn primitives. Theme system functional.
</details>

<details>
<summary><strong>Phase 3: Library & Content Components</strong> (10 tasks) - Latest: 2582e99</summary>

- [x] Migrate ImageTile to Card + Button + Tooltip (d3f58bc)
- [x] Update ImageSkeleton with Skeleton component (2058bcf)
- [x] Migrate ImageList to ScrollArea + Card (ec100d3)
- [x] Rebuild EmptyState with Card + Button (c3a18b9)
- [x] Rebuild UploadZone with Card + Progress + Alert (4f77582)
- [x] Migrate UploadProgressHeader with Card + Progress (f7ccc76)
- [x] Update FileList with ScrollArea virtualization (97456d3)
- [x] Migrate AssetIntegrityBanner to Alert (9c77548)
- [x] Migrate BlobErrorBanner to Alert (2582e99)

**Deliverable**: Image display and upload components rebuilt. Core user flows functional.
</details>

<details>
<summary><strong>Phase 4: Search & Domain Components</strong> (7 tasks) - Latest: 1cffd85</summary>

- [x] Rebuild QuerySyntaxIndicator with Badge + Tooltip (fc3e89c)
- [x] Migrate SimilarityScoreLegend to Card + Badge (616baef)
- [x] Rebuild SearchLoadingScreen with Skeleton (ee53452)
- [x] Rebuild TagInput with Input + Badge + Popover (d599e39)
- [x] Migrate DeleteConfirmationModal to AlertDialog (fa67f69)
- [x] Replace Toast with Sonner integration (a56faf0)
- [x] Simplify StatusLine with Badge + Separator (67b8b0a)
- [x] Rebuild StatsDisplay with Badge + Separator (1cffd85)

**Deliverable**: All domain components rebuilt on shadcn primitives. Search and tagging functional.
</details>

**Total Completed**: 34 tasks across 4 phases
**Code Reduction**: ~600 lines removed, significant simplification
**Key Achievement**: Zero breaking changes to consuming components

---

## 🚧 Phase 5: Polish & Hardening (Remaining Work)

### 5.1 Accessibility Audit

- [ ] **Test complete keyboard navigation flow** (2hr)
  - Manual testing with keyboard only (Tab, Enter, ESC)
  - Verify all actions accessible, focus order logical
  - Add missing tabIndex, aria-labels, keyboard handlers

- [ ] **Verify ARIA labels on interactive elements** (1.5hr)
  - Use browser DevTools accessibility inspector
  - Check aria-label, aria-labelledby, aria-describedby
  - Fix incorrect role assignments

- [ ] **Validate color contrast ratios (WCAG 2.1 AA)** (1hr)
  - Test contrast ≥4.5:1 for text, ≥3:1 for large text
  - Use WebAIM or browser contrast checker
  - Adjust CSS variables for insufficient contrast

### 5.2 Theme Implementation

- [ ] **Add theme toggle to navbar** (30min)
  - Add ThemeToggle to navbar right section
  - Use Button (variant="ghost") with Sun/Moon icons
  - Verify preference persists, icon toggles

- [ ] **Test all components in both light and dark themes** (2hr)
  - Manual testing across all pages
  - Verify readability and contrast in both themes
  - Fix visibility issues, adjust component colors if needed

### 5.3 Responsive Design Testing

- [ ] **Test on mobile viewport (375px)** (1.5hr)
  - Browser DevTools responsive mode
  - Touch targets ≥44px, no horizontal scroll
  - Fix breakpoints, button sizes, overflowing content

- [ ] **Test on tablet viewport (768px)** (1hr)
  - Verify grid layouts adapt, navigation accessible
  - Adjust spacing for medium screens

- [ ] **Test on desktop viewport (1440px+)** (45min)
  - Verify max-width containers, content centering
  - Adjust grid column counts for ultra-wide

### 5.4 Performance Optimization

- [ ] **Implement lazy loading for heavy components** (1hr)
  - Use next/dynamic for CommandPalette, ImageGrid
  - Test Lighthouse performance score
  - Verify initial bundle size reduced

- [ ] **Analyze and optimize bundle size** (1hr)
  - Add bundle analyzer: `pnpm build && pnpm analyze`
  - Identify large dependencies, remove unused imports
  - Consider code splitting for large pages

### 5.5 Cleanup and Documentation

- [ ] **Remove old custom component files** (30min)
  - Delete: corner-brackets.tsx, chrome-spacers.tsx, test pages
  - Verify: pnpm build succeeds, no import errors

- [ ] **Remove terminal aesthetic CSS** (20min)
  - Delete remaining --color-terminal-* vars
  - Remove unused custom animations
  - Verify: No CSS warnings, styles render correctly

- [ ] **Update CLAUDE.md with new component patterns** (45min)
  - Document shadcn usage patterns, variant examples
  - Add import patterns, common compositions
  - Include customization approach

- [ ] **Run final build and type check** (20min)
  - Command: `pnpm type-check && pnpm lint && pnpm build`
  - Verify: All pass without errors
  - Test: Production build starts with `pnpm start`

**Phase 5 Deliverable**: Production-ready application. Accessible, performant, responsive.

---

## 📊 Overall Progress

- **Phase 1**: ✅ Complete (6/6 tasks)
- **Phase 2**: ✅ Complete (11/11 tasks)
- **Phase 3**: ✅ Complete (10/10 tasks)
- **Phase 4**: ✅ Complete (7/7 tasks)
- **Phase 5**: 🚧 In Progress (0/13 tasks)

**Total**: 34/47 tasks complete (72%)

---

## 🎯 Success Criteria

- ✅ All 51 custom components replaced with shadcn-based implementations
- ✅ Component count reduced to ~15 domain components + shadcn primitives
- [ ] WCAG 2.1 AA accessibility compliance achieved
- [ ] 100% keyboard navigable interface
- [ ] Light and dark themes functional
- [ ] Build, type-check, and lint pass without errors
- [ ] Responsive on mobile (375px), tablet (768px), desktop (1440px+)
- [ ] Performance baseline maintained or improved

---

## 📝 Development Notes

**Module Boundaries**:
- **shadcn/ui primitives**: Hide Radix UI complexity, provide variant-based APIs
- **Domain components**: Compose primitives, manage business logic, hide state management
- **Hooks/lib**: Preserved—virtual scrolling, upload queue, search caching

**Testing Strategy**:
- Use vitest: `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`
- Build scripts: `pnpm build`, `pnpm type-check`, `pnpm lint`
- Follow React Testing Library conventions in `__tests__/`

**Key Patterns**:
- Replace terminal colors → semantic tokens (text-muted-foreground, bg-primary)
- Replace custom SVG → Lucide icons
- Replace custom modals → shadcn Dialog/AlertDialog
- Preserve business logic, replace only UI layer

---

*Last Updated: 2025-10-17*
*Current Branch: redesign/shadcn-migration*
*Latest Commit: 1cffd85*
