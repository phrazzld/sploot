# TODO: Comprehensive shadcn/ui Migration

## Context

**Approach**: Complete UI redesign—replace all 51 custom components with shadcn/ui primitives + domain compositions. Zero backward compatibility. Clean architectural foundation.

**Key Files**:
- `app/globals.css` - Design system tokens
- `components/ui/*` - shadcn primitive components (to be created)
- `components/chrome/*` - Navigation and UI chrome (16 files to migrate)
- `components/library/*` - Image display components (9 files to migrate)
- `components/upload/*` - Upload UI (6 files to migrate)
- `components/search/*` - Search components (7 files to migrate)

**Patterns**:
- Use vitest for testing (`pnpm test`)
- Follow React Testing Library conventions in `__tests__/`
- Preserve domain logic in hooks/lib, replace only UI layer
- Build scripts: `pnpm build`, `pnpm type-check`, `pnpm lint`

**Module Boundaries**:
- **shadcn/ui primitives**: Hide Radix UI complexity, provide variant-based APIs
- **Domain components**: Compose primitives, manage business logic, hide state management
- **Hooks/lib**: Preserve existing—virtual scrolling, upload queue, search caching

---

## Phase 1: Foundation Setup

### 1.1 Initialize shadcn/ui Configuration

- [x] Initialize shadcn/ui and create components.json
  ```
  Files: components.json (new), app/globals.css:1-199
  Command: npx shadcn@latest init
  Approach: Select Next.js 15, TypeScript, Tailwind CSS v4, CSS variables
  Config: Set baseColor to "slate", style to "new-york", aliases to "@/components"
  Success: components.json exists, CLI prompts completed successfully
  Test: Run `npx shadcn@latest add button` test (don't commit yet)
  Module: Infrastructure—shadcn configuration foundation
  Time: 15min
  Commit: 54596c6
  ```

- [x] Setup shadcn MCP server for AI-assisted component installation
  ```
  Files: .mcp.json, .claude/settings.local.json
  Command: MCP server auto-configured during shadcn init
  Approach: shadcn init automatically added server to .mcp.json
  Config: {"command": "npx", "args": ["shadcn@latest", "mcp"]}
  Success: MCP server accessible, can query @shadcn registry
  Test: Searched for "button" - found 34 items including button (ui) component
  Module: Developer tooling—AI component discovery
  Time: 5min
  Note: MCP server was already configured in previous init step (commit 54596c6)
  ```

### 1.2 Install Core Primitive Components

- [x] Install base UI primitives (batch 1: core interactions)
  ```
  Files: components/ui/* (5 new files: button, input, label, card, dialog)
  Command: npx shadcn@latest add button input label card dialog
  Success: Components installed to components/ui/, no TypeScript errors
  Test: Import and render Button in test page, verify styling works
  Module: Primitive components—basic interactions
  Time: 20min
  Commit: 88d5e2e
  Work Log:
  - Installed lucide-react (required by dialog component for X icon)
  - Created test page at /test-shadcn-batch1 with all 5 components
  - Verified build passes, type-check passes, all variants render
  - CVA provides type-safe variant system (6 button variants tested)
  ```

- [x] Install navigation and feedback primitives (batch 2)
  ```
  Files: components/ui/* (5 new files: dropdown-menu, tooltip, badge, separator, avatar)
  Command: npx shadcn@latest add dropdown-menu tooltip badge separator avatar
  Success: All components installed, types resolve correctly
  Test: Render each component in isolation, verify Radix UI integration
  Module: Primitive components—navigation patterns
  Time: 20min
  Commit: c3b1b72
  Work Log:
  - Created test page at /test-shadcn-batch2 with all 5 components
  - Verified Radix UI keyboard navigation (dropdown menu arrow keys work)
  - Tested avatar fallback behavior (renders fallback when image fails)
  - Badge variants render with correct semantic colors
  - Separator works in both horizontal and vertical orientations
  ```

- [x] Install advanced primitives (batch 3: complex interactions)
  ```
  Files: components/ui/* (6 new files: command, tabs, popover, select, checkbox, scroll-area)
  Command: npx shadcn@latest add command tabs popover select checkbox scroll-area
  Success: All components installed, no dependency conflicts
  Test: Command palette renders, keyboard nav works, scrollarea scrolls
  Module: Primitive components—advanced interactions
  Time: 20min
  Commit: 4f44b21
  Work Log:
  - Added cmdk dependency (command component uses it for fuzzy search)
  - Created test page at /test-shadcn-batch3 with all 6 components
  - Verified command search filtering works (type to filter items)
  - Tested tab switching (clicks and keyboard work correctly)
  - Verified scrollarea scrolls smoothly with 50 items
  - Checkbox state management working correctly
  ```

- [x] Install feedback and loading primitives (batch 4)
  ```
  Files: components/ui/* (3 new files: skeleton, alert, progress)
  Command: npx shadcn@latest add skeleton alert progress
  Success: All components installed, animation utilities work
  Test: Skeleton animates, toast notifications display, progress updates
  Module: Primitive components—user feedback
  Time: 15min
  Commit: 8b6be75
  Work Log:
  - Skipped toast installation (custom component already exists)
  - Created test page at /test-shadcn-batch4 with all components
  - Verified skeleton pulse animation works smoothly
  - Tested alert variants (default, destructive) with Lucide icons
  - Progress bar animates correctly with state updates
  - All 19 shadcn primitives now installed and tested
  ```

### 1.3 Migrate Design System Tokens

- [x] Replace custom CSS with shadcn color variables
  ```
  Files: app/globals.css:6-8 (removed lines 7-13)
  Approach: Remove terminal color system, add shadcn HSL variables
  Replace:
    --color-terminal-green, --color-terminal-red, etc.
  With:
    --primary, --secondary, --accent, --destructive, --muted (HSL format)
  Success: No more --color-terminal-* references, shadcn vars defined
  Test: Button variants render with correct semantic colors
  Module: Design tokens—semantic color system
  Time: 30min
  Commit: 30f4cc1
  Work Log:
  - Removed terminal color variables (green, red, yellow, gray)
  - shadcn variables already present from init (lines 9-45)
  - Dark mode variants defined (lines 260-292)
  - 24 components reference terminal colors - will be fixed in Phase 2-4
  - Build passes, shadcn test pages render correctly
  ```

- [x] Remove custom animations and add shadcn animations
  ```
  Files: app/globals.css:82-110 (deleted lines 109-252)
  Approach: Delete shimmer, fadeInScale, slideDown animations
  Keep: Basic fadeIn/fadeOut if needed for transitions
  Add: shadcn animation utilities via tailwindcss-animate plugin
  Success: No custom @keyframes, only Tailwind/shadcn animations
  Test: Dialog animations work, accordion down/up animations smooth
  Module: Animation system—Radix UI animations
  Time: 20min
  Commit: 15074f4
  Work Log:
  - Removed: scaleIn, fadeInScale, shimmer, slideDown, dropdown animations
  - Kept: fadeIn/fadeOut for backward compatibility (9 components use them)
  - tailwindcss-animate provides: animate-in/out, fade, zoom, slide variants
  - Verified Dialog uses data-[state] with zoom-in-95/fade-in-0 animations
  - Build passes, animations work on shadcn test pages
  ```

- [x] Update font configuration to work with shadcn
  ```
  Files: app/layout.tsx:122, app/globals.css:45-46
  Approach: Keep Geist Sans and JetBrains Mono, ensure CSS vars match shadcn
  Update: Ensure --font-sans and --font-mono align with shadcn expectations
  Success: Typography renders correctly, monospace preserved for technical data
  Test: Text renders in Geist Sans by default, code uses JetBrains Mono
  Module: Typography—font loading and CSS variables
  Time: 15min
  Commit: 5880ff2
  Work Log:
  - Added font-sans utility class to body element (layout.tsx:122)
  - Verified @theme block correctly maps fonts (globals.css:45-46)
  - --font-sans → var(--font-geist-sans) ✓
  - --font-mono → var(--font-jetbrains-mono) ✓
  - Build passes, type-check passes
  - Body applies: CSS variables + font-sans + antialiased
  ```

### 1.4 Install Required Dependencies

- [x] Install shadcn peer dependencies
  ```
  Files: package.json, pnpm-lock.yaml
  Command: pnpm add class-variance-authority clsx tailwind-merge lucide-react
  Approach: Install CVA for variants, Lucide for icons (replace custom SVGs)
  Success: Dependencies installed, no peer dependency warnings
  Test: Import { cva } and lucide icons, verify tree-shaking works
  Module: Dependencies—variant management and icons
  Time: 10min
  Note: Dependencies already installed during shadcn component batches
  Work Log:
  - Verified all 4 dependencies installed: CVA 0.7.1, clsx 2.1.1, tailwind-merge 3.3.1, lucide-react 0.546.0
  - Confirmed no peer dependency warnings with pnpm list
  - Tested imports: cva, clsx, twMerge, lucide icons all functional
  - Verified usage in components: CVA (3 files), lucide-react (5 files)
  - Confirmed lib/utils.ts cn() helper uses clsx + tailwind-merge
  - Tree-shaking ready with named exports
  ```

- [x] Verify Tailwind CSS v4 compatibility
  ```
  Files: package.json (check version), pnpm build output
  Command: pnpm build && pnpm type-check
  Approach: Ensure @tailwindcss/postcss ^4.1.13 works with shadcn
  Success: Build completes without Tailwind errors, CSS generated correctly
  Test: Production build succeeds, shadcn components styled correctly
  Module: Build system—Tailwind v4 integration
  Time: 10min
  Commit: 8e4c76e
  Work Log:
  - Verified Tailwind CSS v4.1.13 installed (@tailwindcss/postcss 4.1.13)
  - Type-check passes with no errors
  - Production build succeeds (✓ Compiled successfully in 2.6s)
  - CSS generated correctly (4.4k .next/static/css/*.css)
  - All three fonts loaded: Geist, Geist Mono, JetBrains Mono
  - Font CSS variables properly defined (__variable_* classes)
  - @theme block working correctly with Tailwind v4
  - shadcn components styled with proper design tokens
  - No Tailwind errors or warnings in build output
  ```

**Phase 1 Deliverable**: shadcn/ui infrastructure installed, 19 primitive components available, design tokens migrated, MCP server configured.

---

## Phase 2: Core UI Components (Navigation & Chrome)

### 2.1 Navigation Components

- [x] Migrate Navbar to use shadcn design tokens
  ```
  Files: components/chrome/navbar.tsx:41
  Pattern: Follow shadcn border token usage from components/ui/button.tsx

  Approach:
  1. Replace hardcoded border-[#1A1A1A] with border-border (shadcn token)
  2. Remove backdrop-blur-sm (not needed with shadcn design system)
  3. Replace bg-black with bg-background (shadcn token)
  4. Keep all existing layout, positioning, and child components unchanged
  5. Preserve LogoWordmark and UserAvatar integration

  Changes made:
  - Line 41: 'bg-black border-b border-[#1A1A1A]' → 'bg-background border-b border-border'
  - Removed 'backdrop-blur-sm' line entirely

  Success criteria: ✅ All met
  - Navbar uses shadcn design tokens (border-border, bg-background)
  - No hardcoded color values (#1A1A1A)
  - No backdrop-blur classes
  - Build passes (✓ Compiled successfully in 3.3s)
  - Type-check passes
  - Responsive layout preserved

  Dependencies: None (shadcn tokens already defined in globals.css)
  Note: Theme toggle will be added in separate task after theme system implemented
  Module: Navigation—design token migration
  Time: 10min
  Commit: 004694e
  ```

- [x] Implement theme toggle and provider
  ```
  Files: components/theme-provider.tsx (new), components/theme-toggle.tsx (new), app/layout.tsx
  Approach: Use next-themes package, follow shadcn dark mode guide
  Pattern: Create context provider, add toggle button with Sun/Moon icons
  Add: localStorage persistence, system preference detection
  Success: Theme switches between light/dark, preference persists
  Test: Toggle switches themes, localStorage updated, system preference respected
  Module: Theme system—light/dark mode management
  Time: 30min
  Commit: 6291dd5
  Work Log:
  - Installed next-themes 0.4.6 package
  - Created ThemeProvider wrapper component (components/theme-provider.tsx)
  - Created ThemeToggle component with Sun/Moon icons (components/theme-toggle.tsx)
  - Integrated ThemeProvider in app/layout.tsx with system preference support
  - Configured: attribute="class", defaultTheme="system", enableSystem=true
  - Added suppressHydrationWarning to html tag to prevent mismatch
  - Used lucide-react Sun/Moon icons with rotation transitions
  - Prevented hydration issues with mounted state check
  - Build passes, type-check passes
  - Dark mode CSS variables already configured in globals.css
  ```

- [x] Migrate User Avatar and dropdown menu
  ```
  Files: components/chrome/user-avatar.tsx:1-172
  Approach: Replace with shadcn Avatar + DropdownMenu
  Pattern: Keep Clerk user data integration, simplify dropdown items
  Remove: Custom hover states, manual dropdown positioning
  Add: DropdownMenuSeparator, DropdownMenuLabel for structure
  Success: Avatar displays user image, dropdown shows sign out action
  Test: Avatar renders with fallback, dropdown keyboard navigation works
  Module: User menu—authentication UI
  Time: 45min
  Commit: 58642f3
  Work Log:
  - Replaced custom dropdown with shadcn DropdownMenu primitive
  - Replaced custom SVG icons with Lucide (Settings, LogOut)
  - Used destructive variant for sign-out menu item
  - Preserved all Clerk auth integration and handlers
  - Simplified from 225 lines to 172 lines (53 line reduction)
  - Build passes, type-check passes
  ```

- [x] Simplify Logo/Wordmark component
  ```
  Files: components/chrome/logo-wordmark.tsx:1-65, navbar.tsx:52-70
  Approach: Keep SVG, remove custom size variants, use Tailwind directly
  Pattern: Minimal component, just SVG + text, no abstraction needed
  Remove: Size props, custom variant logic, showTagline prop
  Success: Logo renders at correct size, responsive breakpoints work
  Test: Logo displays on mobile and desktop, scales correctly
  Module: Branding—simple logo display
  Time: 20min
  Commit: 452c612
  Work Log:
  - Removed variant prop (default/compact/icon-only)
  - Removed size prop (sm/md/lg) - now handled by Tailwind responsive classes
  - Removed showTagline prop (never used in codebase)
  - Built-in responsive: mobile shows 's', desktop shows 'sploot'
  - Replaced terminal colors with shadcn tokens (bg-primary, text-foreground)
  - Simplified from 148 lines to 65 lines (56% reduction)
  - Updated navbar to use single LogoWordmark (removed conditional mobile/desktop)
  - Module value improved: simpler interface, same functionality
  ```

### 2.2 Search and Command Components

- [x] Rebuild SearchBar with shadcn Input
  ```
  Files: components/chrome/search-bar-elastic.tsx:1-236
  Approach: Replace custom input with shadcn Input component
  Pattern: Keep debounce logic, search state management in parent
  Remove: Custom border animations, custom SVG icons
  Add: Badge for search state (loading, success, error), Lucide icons
  Success: Search input works, debouncing preserved, state indicators display
  Test: Search executes on Enter, debounce prevents excessive queries
  Module: Search input—primary search interface
  Time: 1hr
  Commit: 8068a99
  Work Log:
  - Replaced custom input with shadcn Input component
  - Replaced custom SVG icons with Lucide (Search, X)
  - Added Badge for "Searching..." state indicator
  - Replaced terminal colors with shadcn tokens:
    - text-primary (focus), text-muted-foreground (default)
    - text-destructive (clear hover), bg-background/border-border (kbd)
  - Preserved elastic width expansion (200→400px)
  - Preserved URL state, keyboard shortcuts (/, Enter, Esc)
  - Preserved click-outside collapse behavior
  - Simplified from 262 to 236 lines (10% reduction)
  - SearchTrigger updated with Lucide icon, shadcn colors
  ```

- [x] Rebuild Command Palette with shadcn Command
  ```
  Files: components/chrome/command-palette.tsx:1-183
  Approach: Replace entire component with shadcn Command primitive
  Pattern: Follow shadcn Command docs, use CommandDialog wrapper
  Remove: Custom keyboard handling, manual filtering, custom styling, custom SVG icons
  Add: CommandEmpty, CommandGroup, CommandSeparator for structure, Lucide icons
  Success: Cmd+K opens palette, arrow keys navigate, Enter executes
  Test: Keyboard shortcuts work, commands filter correctly, dialog closes
  Module: Command palette—keyboard-driven action menu
  Time: 1.5hr
  Commit: 23a8cc7
  Work Log:
  - Replaced entire component with shadcn CommandDialog
  - Replaced custom keyboard handling with cmdk built-in navigation
  - Replaced custom filtering with automatic fuzzy search
  - Replaced custom SVG icons with Lucide (Upload, Settings, Search, etc.)
  - Organized into 4 groups: Actions, View Density, Navigation, Account
  - Used CommandSeparator for visual separation
  - Used CommandShortcut for keyboard hints
  - Preserved useCommandPalette hook (state management)
  - Automatic features: arrow key nav, Enter executes, Esc closes
  - Simplified from 286 to 183 lines (36% reduction, 103 lines removed)
  - Build passes, type-check passes
  ```

- [x] Create search overlay with Dialog + Command
  ```
  Files: components/chrome/search-overlay.tsx:1-165
  Approach: Combine shadcn Dialog + Command for fullscreen search
  Pattern: Dialog contains Command, passes search results to parent
  Remove: Custom modal styling, manual focus management, custom SVG icons
  Success: Overlay opens, search works, ESC closes, results display
  Test: Focus trapped in dialog, keyboard nav works, results clickable
  Module: Search overlay—fullscreen search experience
  Time: 1hr
  Commit: dd8f63a
  Work Log:
  - Replaced custom backdrop/modal with shadcn Dialog
  - Embedded Command component for search interface
  - Replaced custom SVG icons with Lucide (Search, X)
  - Replaced custom input with CommandInput
  - Replaced hardcoded colors with shadcn tokens
  - Dialog handles focus trap, ESC key, backdrop click automatically
  - CommandEmpty shows suggestions when no query entered
  - CommandItem shows "Search for" action when query exists
  - Used Button component for primary search action
  - Simplified from 235 to 165 lines (30% reduction, 70 lines removed)
  - Automatic accessibility from Radix UI Dialog
  - Build passes, type-check passes
  ```

### 2.3 Controls and Filters

- [x] Rebuild Sort Dropdown with DropdownMenu
  ```
  Files: components/chrome/sort-dropdown.tsx:1-144
  Approach: Replace custom dropdown with shadcn DropdownMenu + RadioGroup
  Pattern: DropdownMenuRadioGroup for mutually exclusive sort options
  Remove: Custom positioning, manual click-outside handling
  Add: DropdownMenuRadioItem with icons, keyboard shortcuts
  Success: Dropdown shows sort options, selection updates, closes on select
  Test: Keyboard nav works, radio selection updates, dropdown repositions
  Module: Sort controls—list sorting UI
  Time: 45min
  Commit: 652f0af
  Work Log:
  - Replaced custom dropdown with shadcn DropdownMenuRadioGroup
  - Replaced custom SVG icons with Lucide (ArrowDown, ArrowUp, ArrowDownAZ, ArrowUpAZ)
  - Replaced hardcoded colors with shadcn tokens (text-muted-foreground)
  - Radix provides automatic keyboard nav, ESC, click-outside, positioning
  - Preserved toggle-direction-on-reselect logic
  - SortButtonCompact uses semantic icons (ArrowDownAZ for name sort)
  - Simplified from 230 to 144 lines (37% reduction, 86 lines removed)
  - Type-check passes
  ```

- [x] Replace Filter Chips with Badge components
  ```
  Files: components/chrome/filter-chips.tsx:1-122
  Approach: Use shadcn Button (variant="default"/"outline") for toggle group
  Pattern: Button with active/inactive variants
  Remove: Custom chip styling, manual hover states
  Success: Filter chips render, active state highlights current filter
  Test: Chips display filters, click toggles state, aria-pressed updates
  Module: Filter chips—filter toggle display
  Time: 30min
  Commit: ca16c9b
  Work Log:
  - Replaced custom button styles with shadcn Button variants
  - Replaced custom SVG icons with Lucide (Star, Clock)
  - Replaced hardcoded colors with shadcn tokens
  - Used variant="default" for active, variant="outline" for inactive
  - Star icon fills when favorites filter active (fill-current)
  - Size mapping: custom 'md' → Button 'default'
  - Simplified from 211 to 122 lines (42% reduction, 89 lines removed)
  - Type-check passes
  ```

- [x] Migrate View Mode Toggle to Tabs
  ```
  Files: components/chrome/view-mode-toggle.tsx:1-130
  Approach: Replace with shadcn Button variants in toggle group pattern
  Pattern: Two buttons (grid/list) with active state, bg-muted container
  Remove: Custom toggle styling, manual active state classes
  Success: Toggle switches views, active state highlights current view
  Test: Click toggles view mode, keyboard nav works (Tab + Enter)
  Module: View controls—grid/list view switcher
  Time: 30min
  Commit: 93043e1
  Work Log:
  - Replaced custom toggle buttons with shadcn Button variants
  - Replaced custom SVG icons with Lucide (LayoutGrid, List)
  - Replaced hardcoded colors with shadcn tokens (bg-muted container)
  - Used variant="default" for active, variant="ghost" for inactive
  - ViewModeCycle uses icon button variants (icon-sm, icon, icon-lg)
  - Container uses bg-muted with p-0.5 and gap-0.5 for pill group effect
  - Simplified from 217 to 130 lines (40% reduction, 87 lines removed)
  - Type-check passes
  ```

- [x] Create Keyboard Shortcuts Help dialog
  ```
  Files: components/chrome/keyboard-shortcuts-help.tsx:1-143
  Approach: Rebuild with shadcn Dialog + custom content layout
  Pattern: DialogHeader, DialogContent with shortcut list, use <kbd> tags
  Remove: Custom modal styling, manual keyboard handling
  Add: DialogDescription, Separator for section breaks
  Success: Dialog opens with "?", displays shortcuts, closes with ESC
  Test: Modal accessible, keyboard shortcuts formatted correctly
  Module: Help dialog—keyboard shortcuts reference
  Time: 45min
  Commit: c7c3f20
  Work Log:
  - Replaced custom backdrop/modal with shadcn Dialog
  - Replaced manual close button with DialogHeader (automatic X button)
  - Replaced hardcoded colors with shadcn tokens (bg-muted/50, text-muted-foreground, border-border)
  - Used DialogHeader, DialogTitle, DialogDescription for semantic structure
  - Used Separator between categories for visual breaks
  - Radix provides automatic ESC handling, focus trap, backdrop click close
  - Removed manual animation classes (Dialog provides smooth transitions)
  - Preserved <kbd> tag styling for keyboard shortcuts
  - Simplified from 163 to 143 lines (12% reduction, 20 lines removed)
  - Type-check passes
  ```

**Phase 2 Deliverable**: Navigation, search, and primary UI chrome rebuilt with shadcn primitives. Theme system functional.

---

## Phase 3: Library & Content Components

### 3.1 Image Display Components

- [x] Migrate ImageTile to shadcn Card + Button
  ```
  Files: components/library/image-tile.tsx:1-620
  Approach: Wrap in shadcn Card, replace action buttons with Button variants
  Pattern: Card > CardContent (image container with floating actions)
  Keep: Embedding status logic, favorite/delete handlers, image loading states
  Remove: Custom card styling, manual hover effects, custom SVG icons
  Add: Tooltip for favorite button, Lucide icons for all actions
  Success: Tiles render in grid, actions work, delete confirmation shows
  Test: Favorite toggles, delete confirms, embedding status updates
  Module: Image tile—single image display with actions
  Time: 2hr
  Commit: d3f58bc
  Work Log:
  - Wrapped component in shadcn Card with CardContent (p-0 for full-bleed image)
  - Replaced custom action buttons with shadcn Button + Lucide icons
  - Added Tooltip for favorite button hover text ("crown as banger" / "drop from bangers")
  - Replaced all custom SVG icons with Lucide: Heart, Trash2, ImageOff, Loader2, AlertCircle, Clock
  - Replaced hardcoded terminal colors with shadcn tokens and Tailwind utilities
  - Preserved all complex logic: embedding retry, circuit breaker, debug mode, React.memo optimization
  - Similarity score borders now use Tailwind color classes (border-green-500, border-yellow-500)
  - Simplified from 716 to 620 lines (13% reduction, 96 lines removed)
  - Type-check passes
  ```

- [x] Update ImageGrid to use shadcn Skeleton
  ```
  Files: components/library/image-skeleton.tsx:1-99
  Approach: Replace custom loading skeletons with shadcn Skeleton
  Pattern: Skeleton component for pulse animation, Card wrapper for tile variant
  Keep: Grid layout logic (handled by ImageGridSkeleton)
  Remove: Custom skeleton shimmer animation, hardcoded bg colors
  Success: Skeleton loaders display with shadcn animations
  Test: Skeletons match ImageTile Card structure, transitions smooth
  Module: Image skeleton—loading placeholder components
  Time: 1.5hr
  Commit: 2058bcf
  Work Log:
  - Replaced custom skeleton divs with shadcn Skeleton component
  - Wrapped tile variant in Card + CardContent to match ImageTile structure
  - Removed hardcoded colors (bg-[#1B1F24], bg-[#2A2F37])
  - Shadcn Skeleton provides built-in pulse animation automatically
  - Preserved tile and list variants, OptimizedImageSkeleton with exit transitions
  - Updated grid columns to match ImageGrid spacing (gap-2, grid-cols-2...xl:6)
  - Simplified from 108 to 99 lines (8% reduction, 9 lines removed)
  - Type-check passes
  ```

- [x] Migrate ImageList to use shadcn ScrollArea + Card
  ```
  Files: components/library/image-list.tsx:1-317
  Approach: Wrap in ScrollArea, use Card for each list item
  Pattern: ScrollArea > list of Cards with Separator between items
  Keep: List layout logic, same handlers as ImageGrid
  Remove: Custom scroll container styling, hardcoded terminal colors
  Success: List view renders, scrolling smooth, items separated
  Test: List scrolls correctly, items clickable, actions work
  Module: Image list—list view of images
  Time: 1hr
  Commit: ec100d3
  Work Log:
  - Wrapped component in shadcn ScrollArea for scrolling container
  - Replaced custom ListRow div with Card component
  - Replaced custom action buttons with shadcn Button + Lucide icons (Heart, Trash2, Loader2)
  - Replaced custom tag badges with shadcn Badge (variant="outline")
  - Added Separator between list items for visual separation
  - Replaced hardcoded colors with shadcn tokens (bg-muted, border-border, text-muted-foreground)
  - Replaced custom hover/focus styles with shadcn focus-visible:ring-2 and hover:border-primary
  - Favorite badge uses green-500 (matching ImageTile green favorite state)
  - Preserved all handlers, scroll detection (92% threshold), empty state transitions
  - Simplified from 324 to 317 lines (2% reduction, 7 lines removed)
  - Type-check passes
  ```

- [x] Rebuild Empty State with shadcn Card + Button
  ```
  Files: components/library/empty-state.tsx:1-176
  Approach: Simple Card with centered content and CTA Button
  Pattern: Card > CardHeader (icon + title + description) > CardFooter (button)
  Remove: Custom empty state styling, manual centering, custom SVG icons
  Add: Lucide ImageIcon and Plus icons, semantic Card components
  Success: Empty state displays when no images, upload button works
  Test: Empty state shows correct variant, button triggers upload
  Module: Empty state—first-use experience
  Time: 30min
  Commit: c3a18b9
  Work Log:
  - Wrapped in shadcn Card with CardHeader, CardTitle, CardDescription, CardFooter
  - Replaced custom image SVG with Lucide ImageIcon
  - Replaced custom plus SVG with Lucide Plus icon
  - Upload button uses shadcn Button with asChild pattern for Link composition
  - Replaced hardcoded colors with shadcn tokens (bg-muted, text-muted-foreground, border-primary)
  - Drag feedback uses border-primary, bg-primary/5, scale-[1.02]
  - Icon container uses rounded-lg border bg-muted for consistency
  - kbd styling uses rounded border bg-muted text-primary
  - Preserved all drag/drop handlers, performance tracking, variants
  - Simplified from 244 to 176 lines (28% reduction, 68 lines removed)
  - Type-check passes
  ```

### 3.2 Upload Components

- [x] Rebuild UploadZone with shadcn Card + Progress
  ```
  Files: components/upload/upload-zone.tsx:1-447
  Approach: Dashed Card for drop zone, Progress for upload status
  Pattern: Card (dashed border) > drag/drop handlers > Progress components
  Keep: File drop logic, upload queue management, error handling
  Remove: Custom drag-over styling, manual progress bars
  Add: Badge for file count, Alert for errors
  Success: Drop zone accepts files, progress shows, uploads complete
  Test: Drag-drop works, multiple files queue, errors display
  Module: Upload zone—file drop and upload interface
  Time: 2hr

  Work Log:
  - Migrated drop zone to Card with border-dashed, hover/drag states
  - Replaced all progress bars with shadcn Progress component
  - Used Badge for status indicators (uploading, success, error, queued)
  - Added Alert for background sync status and recovery notifications
  - Replaced terminal colors with semantic tokens (primary, destructive, muted)
  - Maintained all upload logic: virtual scrolling, adaptive concurrency, error handling
  - Preserved deep module: simple Card/Progress API hiding complex upload orchestration
  - Type check passed, build ready
  ```

- [x] Migrate Upload Progress Header with Card + Progress
  ```
  Files: components/upload/upload-progress-header.tsx:1-89
  Approach: Card header with overall Progress bar
  Pattern: CardHeader (title + stats) > Progress (overall completion)
  Remove: Custom header styling, manual progress calculation
  Success: Header shows upload count and progress, updates in real-time
  Test: Progress bar fills as uploads complete, stats accurate
  Module: Upload header—overall upload status
  Time: 30min

  Work Log:
  - Migrated fixed header card to shadcn Card component
  - Replaced manual progress bars with shadcn Progress (dual-layer: upload + embedding)
  - Used Button variants (ghost for collapse, outline/destructive for actions)
  - Swapped SVG icons with Lucide components (CheckCircle2, AlertCircle, ChevronDown)
  - Replaced terminal colors with semantic tokens (primary, green-500, destructive, muted-foreground)
  - Maintained smooth animation, time estimation, and useUploadProgress hook
  - Type check passed
  ```

- [x] Update File List to use ScrollArea
  ```
  Files: components/upload/file-list-virtual.tsx:1-267
  Approach: Wrap virtual list in shadcn ScrollArea
  Pattern: Keep virtualization, replace scroll container with ScrollArea
  Keep: Virtual scrolling performance, file item rendering
  Remove: Custom scrollbar styling
  Success: File list scrolls smoothly, virtualization works
  Test: Large file lists render quickly, scrolling performant
  Module: File list—virtualized upload queue display
  Time: 45min

  Work Log:
  - Wrapped virtualized container in shadcn ScrollArea
  - Migrated file rows to Card with semantic border colors
  - Replaced manual progress bars with shadcn Progress
  - Used Badge for status indicators (queued, uploading, pending)
  - Migrated duplicate view link to shadcn Button (link variant)
  - Replaced all hardcoded colors with semantic tokens (primary, yellow-500, muted, muted-foreground)
  - Preserved virtualization: dynamic sizing, overscan, CSS containment for 60fps with 10k+ files
  - Type check passed
  ```

- [x] Replace Background Sync Status with Toast
  ```
  Files: components/upload/background-sync-status.tsx:1-87
  Approach: Use shadcn toast (Sonner) for sync notifications
  Pattern: Call toast() with status message and variant
  Remove: Entire custom status component
  Add: Install sonner package, configure toast provider
  Success: Sync status shows as toast, auto-dismisses, action button works
  Test: Toast appears on sync events, multiple toasts stack correctly
  Module: Sync notifications—background upload feedback
  Time: 45min

  Work Log:
  - Component not in use (grep found no imports)
  - Background sync status already handled inline in UploadZone via Alert (migrated in previous task)
  - Custom toast system already exists in components/ui/toast.tsx with showToast() helper
  - Skipping as redundant - sync notifications use existing Alert + toast infrastructure
  ```

### 3.3 Banners and Alerts

- [x] Migrate Asset Integrity Banner to shadcn Alert
  ```
  Files: components/library/asset-integrity-banner.tsx:1-34
  Approach: Replace with Alert (variant="destructive")
  Pattern: Alert > AlertTitle + AlertDescription + action Button
  Remove: Custom banner styling, manual slide-down animation
  Success: Banner displays on integrity issues, action button triggers audit
  Test: Banner renders when integrity issue detected, dismisses correctly
  Module: Integrity banner—data consistency warning
  Time: 20min

  Work Log:
  - Migrated to Alert with variant="destructive"
  - Replaced SVG icons with Lucide (AlertTriangle, ClipboardCheck, X)
  - Used Button variants (outline with custom destructive colors, ghost for dismiss)
  - Replaced animate-slide-down with Tailwind animate-in utilities
  - Swapped hardcoded yellow/gray colors with semantic tokens (destructive, muted-foreground)
  - Simplified from 70 to 56 lines
  - Type check passed
  ```

- [x] Migrate Blob Error Banner to shadcn Alert
  ```
  Files: components/library/blob-error-banner.tsx:1-47
  Approach: Replace with Alert (variant="destructive")
  Pattern: Same as integrity banner, different message/action
  Success: Banner shows on blob errors, retry button works
  Test: Banner displays on blob failures, action triggers retry
  Module: Blob error—storage failure notification
  Time: 20min

  Work Log:
  - Migrated to Alert with variant="destructive", fixed positioning
  - Replaced SVG icons with Lucide (AlertTriangle with animate-pulse, RotateCw)
  - Used Button (outline variant with custom primary colors for retry action)
  - Replaced animate-slide-down with Tailwind animate-in utilities
  - Swapped hardcoded colors (orange-400, #7C5CFF) with semantic tokens (destructive, primary)
  - Preserved circuit breaker countdown functionality and reset handler
  - Simplified from 56 to 44 lines
  - Type check passed
  ```

**Phase 3 Deliverable**: Image display and upload components rebuilt with shadcn primitives. Core user flows functional.

---

## Phase 4: Search & Domain Components

### 4.1 Search Components

- [x] Rebuild Query Syntax Indicator with Badge + Tooltip
  ```
  Files: components/search/query-syntax-indicator.tsx:1-63
  Approach: Badge with query info, Tooltip with syntax help
  Pattern: Badge (variant based on result count) + TooltipProvider wrapper
  Remove: Custom indicator styling
  Add: Semantic color variants (success=results, warning=no results)
  Success: Indicator shows query info, tooltip explains syntax on hover
  Test: Badge renders with correct variant, tooltip displays on hover
  Module: Query indicator—search query feedback
  Time: 30min

  Work Log:
  - Replaced terminal-style text with Badge components (outline, secondary, default, destructive variants)
  - Query badge: outline variant with monospace font
  - Filters badge: secondary variant with yellow-500 text
  - Results badge: dynamic variant (green-500 for results, destructive for none)
  - Latency badge: outline variant with muted text
  - Added Tooltip with HelpCircle icon for syntax help
  - Replaced manual separators with gap spacing
  - Swapped terminal colors with semantic tokens (muted-foreground, green-500, yellow-500)
  - Type check passed
  ```

- [~] Migrate Similarity Score Legend to Card + Badge
  ```
  Files: components/search/similarity-score-legend.tsx:1-51
  Approach: Card with color-coded Badges for score ranges
  Pattern: Card > CardContent with Badge grid showing score meanings
  Remove: Custom legend styling
  Success: Legend displays score ranges with colors, matches tile badges
  Test: Legend renders, colors match similarity scores on tiles
  Module: Score legend—similarity score reference
  Time: 30min
  ```

- [ ] Rebuild Search Loading Screen with Skeleton
  ```
  Files: components/search/search-loading-screen.tsx:1-32
  Approach: Grid of shadcn Skeleton components
  Pattern: Grid layout with Skeleton placeholders matching expected results
  Remove: Custom loading animation
  Success: Loading screen shows while search executes, transitions to results
  Test: Skeleton displays during search, disappears when results load
  Module: Search loading—async search feedback
  Time: 20min
  ```

### 4.2 Tags Components

- [ ] Rebuild Tag Input with Input + Badge + Popover
  ```
  Files: components/tags/tag-input.tsx:1-189
  Approach: Input for new tags, Badges for existing, Popover for suggestions
  Pattern: Input with Badge array, Popover shows tag suggestions on focus
  Remove: Custom tag chip styling, manual dropdown positioning
  Add: Badge (variant="secondary") for tags with remove button
  Success: Tags display as badges, input adds new tags, suggestions appear
  Test: Enter adds tag, click badge removes tag, suggestions selectable
  Module: Tag input—tag management interface
  Time: 1hr
  ```

### 4.3 Modals and Dialogs

- [ ] Migrate Delete Confirmation Modal to AlertDialog
  ```
  Files: components/ui/delete-confirmation-modal.tsx:1-214
  Approach: Replace entirely with shadcn AlertDialog
  Pattern: AlertDialog > AlertDialogHeader + AlertDialogFooter with actions
  Remove: Custom modal component and hook
  Add: AlertDialogCancel and AlertDialogAction buttons
  Success: Confirmation dialog shows, Cancel/Delete buttons work
  Test: Dialog blocks UI, ESC cancels, Delete button triggers callback
  Module: Delete confirmation—destructive action warning
  Time: 45min
  ```

### 4.4 Feedback and Status Components

- [ ] Replace Toast with Sonner integration
  ```
  Files: components/ui/toast.tsx:1-158, app/layout.tsx:5
  Approach: Remove custom toast, install and configure sonner
  Pattern: Add Toaster component to layout, use toast() function
  Remove: Custom toast component and ToastContainer
  Add: pnpm add sonner, import { Toaster } in layout
  Success: Toasts display with semantic variants, auto-dismiss, stack correctly
  Test: Multiple toasts stack, variants styled correctly, actions work
  Module: Toast system—transient notifications
  Time: 45min
  ```

- [ ] Simplify Status Line with Badge + Separator
  ```
  Files: components/chrome/status-line.tsx:1-73
  Approach: Simple Badge components with Separator between items
  Pattern: Horizontal layout of Badge components showing system stats
  Remove: Custom status line styling
  Success: Status displays metrics, updates in real-time, monospace font preserved
  Test: Stats update correctly, separators visible, layout responsive
  Module: Status line—system metrics display
  Time: 30min
  ```

- [ ] Rebuild Stats Display with Badge or Card
  ```
  Files: components/chrome/stats-display.tsx:1-54
  Approach: Inline Badge components or small Card for grouped stats
  Pattern: Badge for single stat, Card for multiple related stats
  Remove: Custom stats styling
  Success: Stats render with semantic colors, update on data changes
  Test: Stats display correct values, colors indicate status
  Module: Stats display—data visualization
  Time: 20min
  ```

**Phase 4 Deliverable**: All domain-specific components rebuilt on shadcn primitives. Search and tagging functional.

---

## Phase 5: Polish & Hardening

### 5.1 Accessibility Audit

- [ ] Test complete keyboard navigation flow
  ```
  Files: All interactive components
  Approach: Manual testing with keyboard only (no mouse)
  Test: Tab through all interactive elements, Enter activates, ESC dismisses
  Success: All actions accessible via keyboard, focus order logical
  Fixes: Add missing tabIndex, aria-labels, keyboard handlers
  Module: Accessibility—keyboard navigation
  Time: 2hr
  ```

- [ ] Verify ARIA labels on interactive elements
  ```
  Files: All button, input, dialog components
  Approach: Use browser DevTools accessibility inspector
  Test: Check aria-label, aria-labelledby, aria-describedby attributes
  Success: Screen readers can describe all interactive elements
  Fixes: Add missing ARIA attributes, fix incorrect role assignments
  Module: Accessibility—screen reader support
  Time: 1.5hr
  ```

- [ ] Validate color contrast ratios (WCAG 2.1 AA)
  ```
  Files: app/globals.css, all components
  Approach: Use browser contrast checker or online tool
  Test: Text contrast ≥4.5:1, large text ≥3:1, interactive elements ≥3:1
  Success: All color combinations meet AA standards in both themes
  Fixes: Adjust CSS variables for insufficient contrast
  Module: Accessibility—color contrast
  Time: 1hr
  ```

### 5.2 Theme Implementation

- [ ] Add theme toggle to navbar
  ```
  Files: components/chrome/navbar.tsx, components/theme-toggle.tsx
  Approach: Add theme toggle button to navbar right section
  Pattern: Button (variant="ghost") with Sun/Moon icon from Lucide
  Success: Toggle switches theme, icon changes, preference persists
  Test: Theme switches immediately, localStorage updated, icon toggles
  Module: Theme UI—user-facing theme control
  Time: 30min
  ```

- [ ] Test all components in both light and dark themes
  ```
  Files: All components
  Approach: Manual testing, switch theme and verify all pages
  Test: Navigate through app, verify readability and contrast in both themes
  Success: No visibility issues, interactive elements clear in both themes
  Fixes: Adjust component-specific colors if needed
  Module: Theme validation—comprehensive theme testing
  Time: 2hr
  ```

### 5.3 Responsive Design Testing

- [ ] Test on mobile viewport (375px)
  ```
  Files: All page components
  Approach: Browser DevTools responsive mode, test 375px width
  Test: Navigate app, verify layout doesn't break, text readable
  Success: Touch targets ≥44px, no horizontal scroll, readable text
  Fixes: Adjust breakpoints, increase button sizes, fix overflowing content
  Module: Responsive—mobile optimization
  Time: 1.5hr
  ```

- [ ] Test on tablet viewport (768px)
  ```
  Files: All page components
  Approach: Browser DevTools responsive mode, test 768px width
  Test: Verify grid layouts adapt, navigation accessible
  Success: Layout uses available space well, no awkward gaps
  Fixes: Adjust grid columns, spacing for medium screens
  Module: Responsive—tablet optimization
  Time: 1hr
  ```

- [ ] Test on desktop viewport (1440px+)
  ```
  Files: All page components
  Approach: Full screen browser, test wide layouts
  Test: Verify max-width containers work, content doesn't stretch too wide
  Success: Content centered on ultra-wide screens, grid maximizes space
  Fixes: Ensure max-width classes applied, adjust grid column counts
  Module: Responsive—desktop optimization
  Time: 45min
  ```

### 5.4 Performance Optimization

- [ ] Implement lazy loading for heavy components
  ```
  Files: app/app/page.tsx, components/chrome/command-palette.tsx
  Approach: Use next/dynamic for large components (Command, ImageGrid)
  Pattern: const CommandPalette = dynamic(() => import('...'), { ssr: false })
  Success: Initial bundle size reduced, components load on interaction
  Test: Lighthouse performance score, bundle size analysis
  Module: Performance—code splitting
  Time: 1hr
  ```

- [ ] Analyze and optimize bundle size
  ```
  Files: package.json, next.config.ts
  Command: pnpm build && pnpm analyze (add analyze script if needed)
  Approach: Use @next/bundle-analyzer to identify large dependencies
  Success: No unexpected large dependencies, tree-shaking effective
  Fixes: Remove unused imports, consider splitting large pages
  Module: Performance—bundle optimization
  Time: 1hr
  ```

### 5.5 Cleanup and Documentation

- [ ] Remove old custom component files
  ```
  Files: components/chrome/corner-brackets.tsx, chrome-spacers.tsx, chrome-test.tsx, upload-test.tsx
  Approach: Delete components no longer needed in new design
  Success: Only domain components and shadcn primitives remain
  Test: pnpm build succeeds, no import errors
  Module: Cleanup—remove obsolete code
  Time: 30min
  ```

- [ ] Remove terminal aesthetic CSS
  ```
  Files: app/globals.css
  Approach: Delete any remaining --color-terminal-* vars, custom animations
  Success: Only shadcn CSS variables remain, no unused @keyframes
  Test: No CSS warnings, styles render correctly
  Module: Cleanup—design system simplification
  Time: 20min
  ```

- [ ] Update CLAUDE.md with new component patterns
  ```
  Files: CLAUDE.md
  Approach: Document shadcn component usage patterns, variant examples
  Add: Import patterns, common compositions, customization approach
  Success: Guide clearly documents how to add new features with shadcn
  Test: Follow guide to add a new component, verify instructions work
  Module: Documentation—development guide
  Time: 45min
  ```

- [ ] Run final build and type check
  ```
  Files: Entire codebase
  Command: pnpm type-check && pnpm lint && pnpm build
  Approach: Verify no TypeScript errors, ESLint warnings, build succeeds
  Success: All commands pass without errors
  Test: Production build starts successfully with pnpm start
  Module: Validation—final checks
  Time: 20min
  ```

**Phase 5 Deliverable**: Production-ready application with complete shadcn/ui integration. Accessible, performant, responsive.

---

## Design Iteration Checkpoints

### After Phase 2 (Navigation Complete)
- Review module boundaries between chrome components
- Identify patterns in navbar, dropdowns, theme system
- Extract common compositions if duplication emerges
- Plan refactoring for Phase 3 if needed

### After Phase 3 (Library Components Complete)
- Review interfaces for ImageGrid, ImageTile, UploadZone
- Identify coupling between components
- Check if CardContent/CardFooter pattern is consistent
- Plan interface simplification if complexity growing

### After Phase 4 (Domain Components Complete)
- Review entire component hierarchy
- Identify opportunities to extract shared compositions
- Check for information leakage (implementation details in interfaces)
- Plan strategic refactoring before Phase 5 polish

---

## Automation Opportunities

1. **Component migration script**: Create script to replace common patterns (e.g., custom Button → shadcn Button)
2. **Import rewriter**: Automate updating imports from old components to new shadcn paths
3. **Color variable replacer**: Script to find/replace terminal colors with shadcn semantic colors
4. **Test generator**: Script to scaffold basic tests for migrated components
5. **Bundle analyzer**: Add `analyze` script to package.json for regular bundle size checks

---

## Success Criteria Summary

- ✅ All 51 custom components replaced with shadcn-based implementations
- ✅ Component count reduced to ~15 domain components + shadcn primitives
- ✅ WCAG 2.1 AA accessibility compliance achieved
- ✅ 100% keyboard navigable interface
- ✅ Light and dark themes functional
- ✅ Build, type-check, and lint pass without errors
- ✅ Responsive on mobile (375px), tablet (768px), desktop (1440px+)
- ✅ Performance baseline maintained or improved (Lighthouse score)
- ✅ MCP server configured for AI-assisted development

---

## Notes

**Module Value Principle**: Each component should provide significant functionality relative to its interface complexity. If a component just wraps another component without adding value, eliminate it.

**Testing Strategy**: Prioritize E2E tests for user flows over unit tests for individual components. shadcn components are already tested—focus tests on domain logic and integrations.

**Parallel Work**: Phases 2, 3, and 4 can be partially parallelized. Navigation (Phase 2) is independent from Library (Phase 3). Start both once Phase 1 foundation is complete.

**Incremental Testing**: Test each component as it's migrated. Don't wait until end of phase—verify immediately after each task.

---

*Created: 2025-01-16*
*Status: Ready for execution*
*Estimated Duration: 4 weeks (80-100 hours)*
