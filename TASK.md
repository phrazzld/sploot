# Comprehensive shadcn/ui Migration - PRD

## Executive Summary

**Problem**: Sploot has 51 custom components with shallow module design—interface complexity ≈ implementation complexity. Every component reinvents state management, accessibility, keyboard handling, and styling patterns. This creates information leakage where changes ripple across the codebase.

**Solution**: Complete UI overhaul using shadcn/ui primitives to build deep modules with simple interfaces hiding complex implementations. Replace all custom components with battle-tested Radix UI foundations.

**User Value**:
- Faster feature development through composable primitives
- Consistent UI patterns across the application
- Production-grade accessibility (keyboard nav, ARIA, screen readers)
- Maintainable codebase with explicit component contracts

**Success Criteria**: Reduce to ~15 domain components built on shadcn primitives, achieve WCAG 2.1 AA compliance, ship complete redesign with modern aesthetic.

---

## User Context

**Who**: Solo developer building personal meme library
**Problem**: Custom component complexity slowing feature development
**Benefit**: Ship faster with consistent, accessible UI patterns
**Metric**: Time to add new feature reduced by 60% (no component boilerplate)

---

## Requirements

### Functional Requirements
1. **Complete Component Migration**: Replace all 51 custom components with shadcn/ui-based implementations
2. **Design System Overhaul**: Implement shadcn-first aesthetic (abandon Bloomberg Terminal theme)
3. **Accessibility**: Full keyboard navigation, ARIA labels, screen reader support
4. **Theme Support**: Light and dark mode with system preference detection
5. **MCP Integration**: Setup shadcn MCP server for AI-assisted development

### Non-Functional Requirements
- **Performance**: Bundle size reduction through tree-shaking (Radix UI)
- **Maintainability**: Deep modules - simple interfaces hiding Radix complexity
- **Extensibility**: Custom variants via Tailwind + CVA (class-variance-authority)
- **Type Safety**: Full TypeScript coverage for all components

---

## Architecture Decision

### Selected Approach: Full shadcn/ui Migration

**Rationale**:
- **Simplicity**: Clean slate eliminates technical debt, no hybrid maintenance burden
- **User Value**: Maximum consistency through unified design system
- **Explicitness**: shadcn components have clear variant contracts (e.g., `variant="outline"`)
- **Low Risk**: User accepts breaking changes, shadcn is battle-tested in production

**Module Boundaries**:

```
┌─────────────────────────────────────────────────────┐
│ Domain Components (Sploot-specific business logic)  │
│ - ImageGrid, UploadZone, SearchBar, CommandPalette  │
│ Interface: Domain-specific props + actions          │
│ Hidden: Composition logic, state management         │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│ shadcn/ui Components (Presentation primitives)      │
│ - Button, Input, Dialog, Command, Card, Dropdown    │
│ Interface: variant, size, disabled, etc.            │
│ Hidden: Radix UI primitives, accessibility, styling │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│ Radix UI Primitives (Headless UI interactions)      │
│ - Accessible components with no styling             │
│ Hidden: ARIA, keyboard handling, focus management   │
└─────────────────────────────────────────────────────┘
```

Each layer changes vocabulary and abstraction level—no information leakage.

### Alternatives Considered

| Approach | Pros | Cons | Why Not Chosen |
|----------|------|------|----------------|
| Hybrid Migration | Lower risk, incremental adoption | Maintains technical debt, mixed patterns | User wants complete overhaul |
| Custom + shadcn Conventions | Minimal change, safe | Doesn't solve complexity problem | No value gain |
| Headless UI Direct | Maximum control | Reinvents shadcn work, more complexity | Lower simplicity score |

---

## Dependencies & Assumptions

### External Dependencies
- **shadcn/ui**: Component library (CLI + primitives)
- **Radix UI**: Headless component primitives (installed via shadcn)
- **class-variance-authority (CVA)**: Type-safe component variants
- **tailwindcss-animate**: Animation utilities
- **Next.js 15**: App Router support
- **Tailwind CSS v4**: Latest version compatibility

### Assumptions
- **Scale**: Single-user application, no massive concurrent load
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge latest 2 versions)
- **Design Flexibility**: User wants opinionated shadcn defaults, not custom aesthetic
- **Deployment**: Vercel platform with edge runtime support
- **Accessibility Target**: WCAG 2.1 AA compliance sufficient (not AAA)

### Integration Requirements
- **Clerk Auth**: Preserve existing authentication flow
- **Vercel Blob**: Maintain image upload/storage integration
- **Prisma**: Keep database schema and queries unchanged
- **Replicate API**: Preserve embeddings service integration

---

## Implementation Phases

### Phase 1: Foundation Setup (Week 1)

**Goal**: Install shadcn/ui infrastructure and core primitives

**Tasks**:
1. Initialize shadcn/ui configuration
   - Run `npx shadcn@latest init`
   - Configure `components.json` for Next.js 15 + Tailwind v4
   - Set base path to `@/components/ui`
   - Choose TypeScript, CSS variables theme

2. Setup shadcn MCP server
   - Install MCP configuration: `npx shadcn-ui-mcp-server`
   - Add to `.claude/settings.local.json`
   - Test component search and installation via MCP

3. Install core primitive components:
   ```bash
   npx shadcn@latest add button
   npx shadcn@latest add input
   npx shadcn@latest add label
   npx shadcn@latest add card
   npx shadcn@latest add dialog
   npx shadcn@latest add command
   npx shadcn@latest add dropdown-menu
   npx shadcn@latest add tabs
   npx shadcn@latest add tooltip
   npx shadcn@latest add skeleton
   npx shadcn@latest add badge
   npx shadcn@latest add separator
   npx shadcn@latest add avatar
   npx shadcn@latest add popover
   npx shadcn@latest add select
   npx shadcn@latest add checkbox
   npx shadcn@latest add scroll-area
   npx shadcn@latest add toast
   ```

4. Migrate design system to shadcn tokens
   - Update `app/globals.css` with shadcn CSS variables
   - Remove custom terminal color system (`--color-terminal-*`)
   - Remove custom animations (shimmer, fadeInScale, etc.)
   - Keep Geist Sans and JetBrains Mono fonts

5. Update Tailwind configuration
   - Ensure compatibility with Tailwind CSS v4
   - Add `tailwindcss-animate` plugin
   - Configure theme extensions for shadcn

**Deliverable**: Working shadcn infrastructure with all primitives installed and MCP server configured.

---

### Phase 2: Core UI Components (Week 2)

**Goal**: Replace navigation, layout, and primary UI chrome

#### 2.1 Navigation & Layout
- **Navbar** (`components/chrome/navbar.tsx`)
  - Replace with shadcn Avatar, Button, Dropdown Menu
  - Implement responsive layout with shadcn utilities
  - Add theme toggle for light/dark mode

- **Logo/Wordmark** (`components/chrome/logo-wordmark.tsx`)
  - Simplify to SVG + shadcn typography
  - Remove custom size variants (use Tailwind directly)

- **User Avatar** (`components/chrome/user-avatar.tsx`)
  - Replace with shadcn Avatar + Dropdown Menu
  - Implement user menu with sign out action

#### 2.2 Search & Command
- **SearchBar** (`components/chrome/search-bar-elastic.tsx`)
  - Rebuild with shadcn Input component
  - Use shadcn Badge for search state indicators
  - Implement loading states with Skeleton

- **Command Palette** (`components/chrome/command-palette.tsx`)
  - Replace entirely with shadcn Command component
  - Use built-in keyboard navigation
  - Implement action shortcuts (upload, settings, etc.)

- **Search Overlay** (`components/chrome/search-overlay.tsx`)
  - Rebuild with shadcn Dialog
  - Use Command component for search results

#### 2.3 Controls & Filters
- **Sort Dropdown** (`components/chrome/sort-dropdown.tsx`)
  - Replace with shadcn Dropdown Menu
  - Use shadcn RadioGroup for sort options

- **Filter Chips** (`components/chrome/filter-chips.tsx`)
  - Replace with shadcn Badge (variant="outline")
  - Add close button with Button (variant="ghost", size="sm")

- **View Mode Toggle** (`components/chrome/view-mode-toggle.tsx`)
  - Replace with shadcn Tabs or Toggle Group
  - Implement grid/list view switching

**Deliverable**: Navigation and primary chrome rebuilt with shadcn primitives.

---

### Phase 3: Library & Content Components (Week 2-3)

#### 3.1 Image Display
- **ImageGrid** (`components/library/image-grid.tsx`)
  - Preserve virtual scrolling logic with @tanstack/react-virtual
  - Replace skeleton loaders with shadcn Skeleton
  - Use shadcn Card for empty states

- **ImageTile** (`components/library/image-tile.tsx`)
  - Rebuild with shadcn Card as container
  - Use shadcn Button (variant="ghost") for favorite/delete
  - Add shadcn Tooltip for metadata display
  - Implement shadcn Dialog for delete confirmation

- **ImageList** (`components/library/image-list.tsx`)
  - Similar to ImageGrid but list layout
  - Use shadcn Separator between items

- **Empty State** (`components/library/empty-state.tsx`)
  - Rebuild with shadcn Card
  - Use shadcn Button for CTA (upload action)

#### 3.2 Upload Components
- **UploadZone** (`components/upload/upload-zone.tsx`)
  - Rebuild with shadcn Card (dashed border variant)
  - Use shadcn Progress for upload status
  - Add shadcn Badge for file type indicators

- **File List** (`components/upload/file-list-virtual.tsx`)
  - Preserve virtualization
  - Use shadcn ScrollArea for container
  - Replace custom progress with shadcn Progress

- **Upload Progress Header** (`components/upload/upload-progress-header.tsx`)
  - Rebuild with shadcn Card header
  - Use shadcn Progress for overall progress

- **Background Sync Status** (`components/upload/background-sync-status.tsx`)
  - Replace with shadcn Toast notifications
  - Use shadcn Badge for status indicators

**Deliverable**: Core library and upload functionality rebuilt with shadcn.

---

### Phase 4: Search & Domain Components (Week 3)

#### 4.1 Search Components
- **Query Syntax Indicator** (`components/search/query-syntax-indicator.tsx`)
  - Rebuild with shadcn Badge + Tooltip
  - Use semantic colors (muted, success, warning)

- **Similarity Score Legend** (`components/search/similarity-score-legend.tsx`)
  - Replace with shadcn Card
  - Use color-coded Badge for score ranges

- **Search Loading Screen** (`components/search/search-loading-screen.tsx`)
  - Rebuild with shadcn Skeleton
  - Add shadcn Spinner (via custom icon)

#### 4.2 Tags & Metadata
- **Tag Input** (`components/tags/tag-input.tsx`)
  - Rebuild with shadcn Input + Badge
  - Use shadcn Popover for tag suggestions

- **Tag Display** (inline in ImageTile)
  - Use shadcn Badge (variant="secondary")
  - Add shadcn Button (variant="ghost") for remove

#### 4.3 Modals & Dialogs
- **Delete Confirmation Modal** (`components/ui/delete-confirmation-modal.tsx`)
  - Replace with shadcn Alert Dialog
  - Use semantic destructive styling

- **Keyboard Shortcuts Help** (`components/chrome/keyboard-shortcuts-help.tsx`)
  - Rebuild with shadcn Dialog
  - Use shadcn Separator for sections
  - Display kbd elements with shadcn typography

#### 4.4 Feedback & Status
- **Toast Notifications** (`components/ui/toast.tsx`)
  - Replace entirely with shadcn Sonner integration
  - Use semantic variants (success, error, info)

- **Status Line** (`components/chrome/status-line.tsx`)
  - Rebuild with shadcn Badge + Separator
  - Use monospace font for technical data

- **Stats Display** (`components/chrome/stats-display.tsx`)
  - Replace with shadcn Card or inline Badge
  - Use semantic colors for metrics

**Deliverable**: All domain-specific components rebuilt on shadcn primitives.

---

### Phase 5: Polish & Hardening (Week 4)

#### 5.1 Accessibility Audit
- Test full keyboard navigation flow (Tab, Enter, Escape, Arrow keys)
- Verify ARIA labels on interactive elements
- Test with screen reader (VoiceOver on macOS)
- Ensure focus indicators visible on all focusable elements
- Validate color contrast ratios (WCAG 2.1 AA)

#### 5.2 Theme Implementation
- Implement light/dark mode toggle in navbar
- Persist theme preference to localStorage
- Respect system preference on first visit
- Test all components in both themes
- Ensure contrast ratios maintained in dark mode

#### 5.3 Responsive Design
- Test on mobile (375px), tablet (768px), desktop (1440px)
- Verify touch targets ≥44px on mobile
- Test virtual scrolling performance on devices
- Validate responsive grid breakpoints

#### 5.4 Performance Optimization
- Lazy load heavy components (ImageGrid, Command Palette)
- Implement code splitting for upload/search pages
- Optimize bundle size with tree-shaking analysis
- Add loading skeletons for async boundaries

#### 5.5 Cleanup & Documentation
- Remove all old custom component files
- Delete unused custom hooks (if any)
- Remove terminal aesthetic CSS (animations, variables)
- Update CLAUDE.md with new component patterns
- Document shadcn customization approach

**Deliverable**: Production-ready application with complete shadcn/ui integration.

---

## Key Decisions & Rationale

### Decision 1: Abandon Terminal Aesthetic
**What**: Remove Bloomberg Terminal × Linear design system entirely
**Alternatives**: Preserve custom aesthetic by heavily customizing shadcn
**Rationale**:
- **User Value**: Modern shadcn aesthetic is familiar to users, requires zero design work
- **Simplicity**: Using shadcn defaults eliminates custom CSS maintenance
- **Explicitness**: Standard color tokens (primary, destructive, muted) are self-documenting
**Tradeoffs**: Lose unique branding, but gain development velocity

### Decision 2: Complete Replacement (No Hybrid)
**What**: Delete custom components entirely, no gradual migration
**Alternatives**: Keep custom components working alongside shadcn during transition
**Rationale**:
- **User Value**: Consistent experience—no mixed UI patterns
- **Simplicity**: Single design system to maintain, no context switching
- **Explicitness**: Clear component ownership (shadcn or domain-specific)
**Tradeoffs**: Higher initial effort, but clean architecture foundation

### Decision 3: shadcn MCP Integration
**What**: Setup Model Context Protocol server for AI-assisted component installation
**Alternatives**: Manual component installation via CLI
**Rationale**:
- **User Value**: Natural language component discovery ("add a data table")
- **Simplicity**: Eliminates doc lookup, faster feature development
- **Explicitness**: MCP provides component documentation inline
**Tradeoffs**: Requires MCP server setup, but minimal ongoing cost

### Decision 4: Preserve Domain Logic
**What**: Keep business logic (virtual scrolling, upload queue, search caching) unchanged
**Alternatives**: Rewrite business logic alongside UI
**Rationale**:
- **User Value**: Zero behavioral regressions, same features
- **Simplicity**: UI and logic separation reduces scope
- **Explicitness**: Domain logic remains in hooks/lib, UI in components
**Tradeoffs**: Some code duplication during transition, but safe approach

### Decision 5: E2E Testing Focus
**What**: Prioritize Playwright E2E tests over unit tests
**Alternatives**: Write unit tests for every component
**Rationale**:
- **User Value**: Tests validate complete user flows, not isolated components
- **Simplicity**: shadcn components are already tested, don't duplicate
- **Explicitness**: E2E tests document critical paths
**Tradeoffs**: Less granular failure detection, but faster test suite development

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Users dislike new aesthetic** | Medium | High | Deploy preview build for feedback before production push |
| **Migration takes >4 weeks** | Medium | Medium | Phase-based approach allows shipping Phase 1-3 as functional MVP |
| **Accessibility regressions** | Low | High | Radix UI provides better defaults than custom components, audit in Phase 5 |
| **Performance degradation** | Low | Medium | Radix UI tree-shakes well, bundle size analysis in Phase 5 |
| **Breaking Clerk/Vercel integrations** | Low | High | Preserve auth/blob logic, only replace UI components |
| **Dark mode contrast issues** | Medium | Medium | Test with automated contrast checker in Phase 5 |
| **Mobile responsive breakage** | Medium | Medium | Test on real devices in Phase 5, shadcn is mobile-first |

---

## Component Migration Mapping

**Complete List**: 51 custom components → shadcn replacements

### Chrome Components (16 files)
- `app-chrome.tsx` → Composition of shadcn primitives (no direct replacement)
- `chrome-spacers.tsx` → Delete (use Tailwind spacing)
- `chrome-test.tsx` → Delete (test file)
- `command-palette.tsx` → shadcn Command
- `corner-brackets.tsx` → Delete (not needed in new design)
- `filter-chips.tsx` → shadcn Badge
- `grid-density-toggle.tsx` → shadcn Tabs or ToggleGroup
- `keyboard-shortcuts-help.tsx` → shadcn Dialog + custom content
- `logo-wordmark.tsx` → Custom SVG + shadcn typography
- `navbar.tsx` → Composition: Avatar, DropdownMenu, Button
- `search-bar-elastic.tsx` → shadcn Input + Badge
- `search-overlay.tsx` → shadcn Dialog + Command
- `settings-gear.tsx` → shadcn Button (variant="ghost")
- `sort-dropdown.tsx` → shadcn DropdownMenu
- `stats-display.tsx` → shadcn Badge or Card
- `status-line.tsx` → shadcn Badge + Separator
- `upload-button.tsx` → shadcn Button
- `user-avatar.tsx` → shadcn Avatar + DropdownMenu
- `view-mode-dropdown.tsx` → shadcn DropdownMenu
- `view-mode-toggle.tsx` → shadcn Tabs

### Library Components (9 files)
- `asset-integrity-banner.tsx` → shadcn Alert
- `blob-error-banner.tsx` → shadcn Alert
- `empty-state.tsx` → shadcn Card + Button
- `image-grid.tsx` → Preserve virtualization + shadcn Skeleton
- `image-grid-error-boundary.tsx` → Keep (error boundary logic)
- `image-list.tsx` → shadcn ScrollArea + Card
- `image-skeleton.tsx` → shadcn Skeleton
- `image-tile.tsx` → shadcn Card + Button + Tooltip
- `image-tile-error-boundary.tsx` → Keep (error boundary logic)

### Search Components (5 files)
- `index.ts` → Update exports
- `query-syntax-indicator.tsx` → shadcn Badge + Tooltip
- `search-bar.tsx` → shadcn Input
- `search-bar-compact.tsx` → shadcn Input (size variant)
- `search-bar-with-results.tsx` → shadcn Input + Popover
- `search-loading-screen.tsx` → shadcn Skeleton
- `similarity-score-legend.tsx` → shadcn Card + Badge

### Upload Components (6 files)
- `background-sync-status.tsx` → shadcn Toast (Sonner)
- `embedding-status-indicator.tsx` → shadcn Badge
- `file-list-virtual.tsx` → shadcn ScrollArea + preserve virtualization
- `upload-error-display.tsx` → shadcn Alert
- `upload-progress-header.tsx` → shadcn Card + Progress
- `upload-zone.tsx` → shadcn Card (dashed variant) + Progress
- `virtual-file-list.tsx` → shadcn ScrollArea

### UI Components (2 files)
- `delete-confirmation-modal.tsx` → shadcn AlertDialog
- `toast.tsx` → shadcn Sonner

### Settings Components (1 file)
- `cache-status.tsx` → shadcn Card + Badge

### Tags Components (1 file)
- `tag-input.tsx` → shadcn Input + Badge + Popover

### Other Components (5 files)
- `error-boundary.tsx` → Keep (React error boundary logic)
- `icons/heart-icon.tsx` → Keep or replace with Lucide React icon
- `offline/offline-provider.tsx` → Keep (offline detection logic)
- `offline/upload-queue-display.tsx` → shadcn Card + Badge
- `upload-test.tsx` → Delete (test file)

---

## Success Metrics

### Quantitative
- **Component count**: 51 custom → ~15 domain components + shadcn primitives (~70% reduction)
- **Bundle size**: Target <20% increase (Radix UI overhead offset by removing custom code)
- **Accessibility**: 100% keyboard navigable, WCAG 2.1 AA compliant
- **Test coverage**: 80%+ E2E coverage for critical user flows
- **Migration time**: Complete in 4 weeks

### Qualitative
- Consistent visual language across entire application
- Faster feature development (use shadcn primitives directly)
- Better developer experience (clear component contracts)
- Modern, professional aesthetic (shadcn-first design)

---

## Implementation Guidelines

### Component Structure Pattern
```tsx
// Domain component built on shadcn primitives
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function ImageTile({ asset, onFavorite }) {
  return (
    <Card>
      <img src={asset.url} alt={asset.filename} />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onFavorite(asset.id)}
      >
        Favorite
      </Button>
    </Card>
  )
}
```

### Theme Customization
```css
/* app/globals.css - shadcn CSS variables */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... shadcn defaults */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode overrides */
  }
}
```

### Variant Usage
```tsx
// Use shadcn variants for consistency
<Button variant="default">Primary Action</Button>
<Button variant="outline">Secondary Action</Button>
<Button variant="ghost">Tertiary Action</Button>
<Button variant="destructive">Delete</Button>
```

---

## Next Steps

1. **Run `/plan`** to break this PRD into granular implementation tasks
2. **Setup Phase 1** (Foundation) before touching any existing components
3. **Component-by-component migration** following the mapping above
4. **Test each phase** before moving to next (prevents cascading failures)
5. **Deploy preview** after Phase 3 for user feedback

---

*Last Updated: 2025-01-16*
*Status: Ready for Implementation*
*Estimated Duration: 4 weeks*
