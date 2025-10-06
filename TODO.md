# TODO: Terminal Aesthetic PR - Final Cleanup

**Context**: PR #3 review feedback analysis identified 2 critical issues that should be fixed before merge. The majority of review concerns were either already addressed, misunderstood the code, or are appropriate for follow-up work (catalogued in BACKLOG.md).

---

## Critical Issues (Merge-Blocking)

- [x] **Remove Duplicate useEffect Hook**

**Location**: `app/app/page.tsx:173-176` and `195-197`

**Problem**: Two identical `useEffect` hooks both setting `isClient` to true:

```typescript
// Lines 173-176
useEffect(() => {
  setIsClient(true);
}, []);

// Lines 195-197 - DUPLICATE
useEffect(() => {
  setIsClient(true);
}, []);
```

**Fix**:
```bash
# Remove the second useEffect (lines 195-197)
# Keep the first one at lines 173-176
```

**Success Criteria**:
- Only one `useEffect` setting `isClient` remains
- `pnpm type-check` passes
- No hydration errors during SSR

**Rationale**: This is redundant code that serves no purpose. One useEffect is sufficient.

---

- [x] **Clean Up Legacy Rounded Corner Focus Styles**

**Location**: `app/globals.css:169-179`

**Problem**: Focus-visible styles reference rounded-lg/xl/full classes that no longer exist in the terminal aesthetic:

```css
/* Ensure focus rings respect component border radius */
.rounded-lg:focus-visible {
  border-radius: 0.5rem;
}

.rounded-xl:focus-visible {
  border-radius: 0.75rem;
}

.rounded-full:focus-visible {
  border-radius: 9999px;
}
```

**Fix**:
```bash
# Delete lines 168-179 (comment + 3 rules)
# Terminal aesthetic uses border-radius: 0 universally
# Base focus-visible rules (lines 139-158) already handle terminal styling
```

**Success Criteria**:
- No `rounded-*` references remain in codebase
- Focus rings still visible on interactive elements
- Terminal aesthetic maintained (square corners everywhere)

**Rationale**: These are legacy styles from pre-terminal aesthetic. Since we removed all rounded corners, these focus styles are dead code. The base focus-visible rules already provide proper keyboard navigation indicators with terminal styling.

---

## Review Feedback Resolution Summary

### ✅ Already Addressed
- **"157 rounded-* instances remain"** → FALSE: Only 3 instances in legacy focus styles (see task #2 above)
- **"Test coverage degradation"** → INVALID: Tests were intentionally removed (commit 110daf5) because they tested mock infrastructure, not business logic
- **"Keyboard shortcut logic bug"** → MISUNDERSTOOD: Reviewers misread lines 39-42. Logic is correct for optional modifiers.

### 🔄 Deferred to BACKLOG.md
- Create `/api/stats` endpoint (performance optimization)
- Refactor useStatusStats interval pattern
- Add ARIA labels for accessibility
- Improve color contrast for WCAG AA compliance
- Add try-catch wrappers for localStorage
- Add unit tests for new terminal components

### ❌ Rejected as Invalid
- **"isClient unused variable"** → FALSE: Used to prevent hydration errors (standard Next.js SSR pattern)
- **"Incomplete terminal aesthetic conversion"** → FALSE: Based on incorrect grep results
- **"Test file deletion blocker"** → INVALID: Deletion was intentional and justified (see commit message 110daf5)

---

## Post-Merge Actions

After merging this PR, immediately create follow-up issues for:
1. Performance optimization (`/api/stats` endpoint) - High priority
2. Accessibility improvements (ARIA labels, contrast) - Medium priority
3. Test coverage for new components - Low priority

See BACKLOG.md for detailed specifications.
