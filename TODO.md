# TODO.md

## Footer Elimination - Reclaim 44px of Vertical Space [COMPLETED]

### Phase 1: Remove Footer Component Dependencies ✓
- [x] Remove Footer import from `/components/chrome/app-chrome.tsx` line 6 (`import { Footer } from './footer';`)
- [x] Remove FooterSpacer import from `/components/chrome/app-chrome.tsx` line 7 (`import { NavbarSpacer, FooterSpacer } from './chrome-spacers';`) - keep NavbarSpacer import intact

### Phase 2: Remove Footer Component Instance ✓
- [x] Delete Footer component JSX block from `/components/chrome/app-chrome.tsx` lines 104-116 (starts with `<Footer` ends with `/>`), preserving surrounding code structure
- [x] Delete FooterSpacer component call from `/components/chrome/app-chrome.tsx` line 119 (`<FooterSpacer />`)

### Phase 3: Adjust Main Content Height Calculation ✓
- [x] Update main element className in `/components/chrome/app-chrome.tsx` line 100 from `min-h-[calc(100vh-100px)]` to `min-h-[calc(100vh-56px)]` to account for navbar-only chrome (56px navbar, no 44px footer)

### Phase 4: Clean Up Spacer Components ✓
- [x] Remove FooterSpacer export from `/components/chrome/chrome-spacers.tsx` lines 12-17 (complete function definition including JSDoc comment)
- [x] Update file-level comment in `/components/chrome/chrome-spacers.tsx` line 2 from "Spacer components to account for fixed navbar/footer height" to "Spacer component to account for fixed navbar height"

### Phase 5: Delete Obsolete Files ✓
- [x] Delete entire file `/components/chrome/footer.tsx` (131 lines of code removed)
- [x] Verify no broken imports after deletion by checking TypeScript compilation
- [x] Fixed test files that referenced the footer component

### Phase 6: Verification ✓
- [x] Confirm main content area now extends to bottom of viewport minus navbar height only
- [x] Verify filter/sort state management still functions via context hooks without footer UI
- [x] Test responsive behavior on mobile/tablet/desktop breakpoints without footer chrome

## Impact Metrics
- **Chrome Reduction**: 100px → 56px (44% reduction)
- **Viewport Gain**: +44px vertical content space
- **Code Removal**: ~150 lines eliminated
- **Component Simplification**: 2 fewer components to maintain