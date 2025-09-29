# TODO

> **Active Work**: Concrete implementation tasks that need to be done now.
> Each task is atomic, testable, and can be completed in a single focused session.

## 🛡️ P1: Error Boundaries & Robustness

### Component-Level Error Handling
- [x] **Add ImageTileErrorBoundary** - Wrap ImageTile in error boundary that catches blob load failures. Render tombstone tile with retry button instead of crashing grid. Use React Error Boundary API. (~25 min)

- [x] **Add circuit breaker for blob requests** - If >3 consecutive blob 404s, pause loading and show banner "Storage connection issue detected. Retrying...". Prevent cascade failures. (~30 min)

- [x] **Log blob errors to monitoring** - On image load failure, send to `/api/telemetry` with: `{assetId, blobUrl, errorType, timestamp}`. Track patterns for debugging. (~15 min)

### Data Integrity Guards
- [x] **Add asset integrity check on mount** - In `useAssets` hook, validate first 10 assets have valid blob URLs. If >50% broken, show warning banner + audit button. Early detection. (~20 min)

- [ ] **Implement optimistic UI rollback** - On upload, show optimistic tile immediately. If upload fails after 10s, animate tile out and show toast error. Don't leave ghost tiles. (~25 min)

## 🔧 P2: Infrastructure & Monitoring

### Automated Cleanup
- [ ] **Create cron job for orphan detection** - Add Vercel Cron route `/api/cron/audit-assets` that runs daily, finds broken blobs, sends alert email if >10 found. Proactive monitoring. (~30 min)

- [ ] **Implement soft delete for assets** - Add `deletedAt` timestamp instead of hard delete. Keep 30-day retention for recovery. Modify delete API to set timestamp, add cron to purge old. (~35 min)

- [ ] **Add blob garbage collection** - Script to find blobs in Vercel Blob storage not referenced by any DB record. Prompt for deletion. Reclaim storage. (~40 min)

### Performance Monitoring
- [ ] **Add empty state render metrics** - Track `time_to_empty_state` metric from data load → empty state render. P95 target <100ms. Send to analytics. (~15 min)

- [ ] **Monitor broken image ratio** - Emit metric `broken_images_count / total_images_count`. Alert if >1%. Dashboard in Vercel Analytics. (~20 min)

- [ ] **Add Core Web Vitals for grid** - Measure CLS (Cumulative Layout Shift) for ImageGrid. Target CLS <0.1. Empty state shouldn't cause layout shift. (~15 min)

---

## 📝 Completed Work

### P0: Ghost Assets Investigation ✓
- ✅ Audited database (100% valid assets, 0 orphans)
- ✅ Added `/api/assets/audit` debug endpoint
- ✅ Fixed transactional upload flow (blob first, then DB)
- ✅ Added Prisma schema validation for blob URLs
- ✅ Created cleanup script `scripts/clean-orphaned-assets.ts`

### P1: Empty State UX Redesign ✓
- ✅ Extracted EmptyState component with variants
- ✅ Implemented minimal design (Crisp Lab aesthetic)
- ✅ Added contextual messages (first-use/filtered/search)
- ✅ Removed redundant upload button
- ✅ Added drag-and-drop visual feedback
- ✅ Implemented smooth skeleton → empty state transition

### P1: Error Handling (Partial)
- ✅ Enhanced broken image fallback UI with delete button

---

## 🎯 Next Steps

**Priority order:**
1. **Error Boundaries** (P1) - Prevent component crashes, improve resilience
2. **Infrastructure** (P2) - Automated monitoring and cleanup

**Estimated time remaining:** ~4 hours of implementation work