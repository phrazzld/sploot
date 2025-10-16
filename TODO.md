# TODO - Fix Upload Pathname Validation Bug

> **Critical Issue**: Production uploads failing due to pathname mismatch in validation
> **Impact**: ALL uploads with spaces/special chars in filename fail after successful upload to blob
> **Root Cause**: Vercel Blob SDK returns original filename, not server-generated pathname with userId prefix
> **Status**: 🔴 BLOCKING - Cannot upload images in production

---

## 🔴 P0: Immediate Fix - Stop Trusting Client Pathname

**The Problem**: Client sends `pathname` to `/api/upload-complete`, server validates it starts with `userId/`, but the pathname client received from Vercel SDK is wrong. Server generated `user_123/timestamp-random.png`, but SDK returned `Screenshot 2025-09-01 at 4.16.52 PM.png`.

**The Fix**: Server should extract pathname from `blobUrl` instead of trusting client.

### Tasks

- [x] **Make pathname parameter optional in upload-complete endpoint**
  - ✅ Completed in commit 87cb49d
  - Made pathname optional in validation, removed from required fields check

- [x] **Extract pathname from blobUrl in validateBlobUrl()**
  - ✅ Completed in commit 87cb49d
  - Changed signature to `(blobUrl, userId, pathname?)`
  - Extracts pathname from URL if not provided
  - Uses extracted pathname for all validation

- [x] **Update upload-complete to use extracted pathname**
  - ✅ Completed in commit 87cb49d
  - Updated call to `validateBlobUrl(blobUrl, userId)`
  - Removed pathname from trust boundary

- [ ] **Test with problematic filenames** 🧪 MANUAL TEST REQUIRED
  - Wait for Vercel preview deployment to complete
  - Navigate to preview URL (check GitHub PR or Vercel dashboard)
  - Upload test images with these filenames:
    - `Screenshot 2025-09-01 at 4.16.52 PM.png` (spaces)
    - `file with spaces.png` (spaces)
    - `文件名.png` (unicode)
    - `test\u202Ffile.png` (U+202F NARROW NO-BREAK SPACE)
  - **Expected**: All uploads succeed, no "Pathname must start with user directory" errors
  - Check browser console and Vercel logs for any validation errors

- [x] **Run full test suite**
  - ✅ All 295 tests pass

- [x] **Run type-check and build**
  - ✅ Type-check: clean
  - ✅ Build: successful

- [x] **Deploy to preview and test**
  - ✅ Pushed to GitHub: commit 87cb49d
  - ✅ Vercel auto-deploy triggered
  - ⏳ Waiting for deployment to complete
  - 🧪 Manual testing required (see task above)

- [ ] **Clean up client-side code (optional)**
  - File: `components/upload/upload-zone.tsx`
  - Line 1242: Can remove `pathname` from request body (server doesn't need it anymore)
  - Only do this AFTER confirming server-side extraction works
  - **Why**: Reduce client-server coupling, simplify request payload

---

## 📋 Validation Checklist

- [ ] Upload with spaces in filename works
- [ ] Upload with unicode characters works
- [ ] Upload with special unicode (U+202F) works
- [ ] Duplicate detection still works correctly
- [ ] Security validation still catches invalid URLs
- [ ] Security validation still enforces userId prefix
- [ ] No regressions in test suite
- [ ] Production deploy successful
- [ ] No errors in Vercel logs

---

## 📚 Reference

**Error that triggered this**:
```
Error: Invalid blob URL: Pathname must start with user directory: user_32sZpNfjTLRH0ecgiJOI3jQO1oN/
```

**Root Cause**: Vercel SDK's `blob.pathname` doesn't reflect server-overridden pathname from `handleUpload`.

**Architecture Issue**: Split state across 3 entities (Server generates → Vercel stores → Client reports back). Any mismatch = failure.

**Carmack's Take**: *"Why are you asking the client what pathname was used? The URL contains the pathname. Parse it. Done."*

**Files Changed**:
- `app/api/upload-complete/route.ts` - Stop requiring pathname from client
- `lib/blob.ts` - Extract pathname from URL server-side

**Estimated Time**: 30 minutes to fix, 30 minutes to test, 30 minutes to deploy = 1.5 hours total

---

**Last Updated**: 2025-10-16
**Status**: 🔴 CRITICAL - Production uploads broken
**Branch**: feature/bulk-upload-optimization
