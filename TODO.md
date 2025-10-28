# TODO: PR #9 Review Feedback Fixes

**Context**: Four issues from PR #9 code review must be fixed before merge. Priority order: P1 blocker → brand critical → code hygiene → performance.

---

## 1. 🚨 P1 BLOCKER: Fix CollectionGrid Animation

**File**: `components/landing/collection-grid.tsx:18`
**Problem**: Tiles permanently invisible due to styled-jsx keyframe scoping mismatch

**Root Cause**: Inline `style` prop references `cascadeIn`/`cascadeLoop`, but `<style jsx>` scopes these keyframes to hashed names. Animation never executes, tiles stay `opacity: 0`.

### Tasks

- [ ] Open `components/landing/collection-grid.tsx`
- [ ] Change line 16: `<style jsx>{` → `<style jsx global>{`
- [ ] Verify build: `pnpm type-check && pnpm build`
- [ ] Test in browser: Visit landing page, scroll to "personal library" section
- [ ] Confirm: 3×3 grid tiles fade in sequentially, then pulse infinitely

**Expected time**: 10 minutes

---

## 2. 🎨 HIGH: Fix Dark Mode Primary Color

**Problem**: Primary color shows as white/gray in dark mode instead of neon violet (#7C5CFF)

**Impact**: Overlapping circles, "matches" label, CTA button all wrong color in dark mode

### Tasks

- [ ] Find where dark mode `--primary` CSS variable is defined (likely `app/globals.css` or `tailwind.config.ts`)
- [ ] Update dark mode primary color to `#7C5CFF` or `oklch(0.62 0.25 280)`
- [ ] Verify build: `pnpm build`
- [ ] Test in browser: Toggle dark mode
- [ ] Confirm all primary elements show neon violet:
  - [ ] Hero: Overlapping circles logo
  - [ ] Section 1: Venn diagram circles
  - [ ] Section 1: "matches" label
  - [ ] Section 2: CollectionGrid borders on hover
  - [ ] Section 3: CTA button background

**Expected time**: 15 minutes

---

## 3. 🧹 Code Hygiene: Delete Unused Component

**File**: `components/landing/feature-card.tsx`

### Tasks

- [ ] Verify component is unused: `grep -r "FeatureCard" app/ components/`
- [ ] Delete file: `rm components/landing/feature-card.tsx`
- [ ] Verify no import errors: `pnpm type-check`
- [ ] Verify build: `pnpm build`

**Expected time**: 2 minutes

---

## 4. ♿ Performance: Add prefers-reduced-motion Support

**File**: `components/landing/collection-grid.tsx`
**Problem**: Infinite animation runs continuously, no respect for motion preferences

### Tasks

- [ ] Add state and media query listener to `CollectionGrid` component:

```tsx
import { useEffect, useState } from "react";

export function CollectionGrid() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // ... rest of component
}
```

- [ ] Update animation style prop to conditionally include infinite loop:

```tsx
style={{
  animation: prefersReducedMotion
    ? `cascadeIn 0.3s ease-out ${i * 0.1}s forwards`
    : `cascadeIn 0.3s ease-out ${i * 0.1}s forwards, cascadeLoop 3s ease-in-out ${1.5 + i * 0.1}s infinite`,
}}
```

- [ ] Test with reduced motion enabled (macOS: System Preferences → Accessibility → Display → Reduce Motion)
- [ ] Confirm: Cascade plays once, infinite loop disabled
- [ ] Verify build: `pnpm build`

**Expected time**: 20 minutes

---

## Verification Checklist

After all fixes:

- [ ] TypeScript: `pnpm type-check`
- [ ] Build: `pnpm build`
- [ ] Tests: `pnpm test`
- [ ] Manual QA:
  - [ ] CollectionGrid tiles visible and animating
  - [ ] Dark mode primary color correct (neon violet)
  - [ ] No import errors from deleted component
  - [ ] Reduced motion preference respected

**Total estimated time**: ~45 minutes
