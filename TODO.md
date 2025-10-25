# TODO: Mobile-Friendly Share & Actions

## Context
Mobile users are hitting two critical UX failures:
1. Share button triggers "not allowed" error on iOS/Android - clipboard API blocked, needs native share sheet
2. Hover-dependent UI (share/delete buttons) invisible on touch devices - `group-hover` doesn't work without mouse
3. Fullscreen modal lacks action buttons - can't share/delete/favorite when viewing full-size image

## Implementation Tasks

### 1. Mobile & Capability Detection

- [ ] Create `hooks/use-is-mobile.ts` for touch device detection
  - Use `window.matchMedia('(hover: none) and (pointer: coarse)')` to detect touch-primary devices
  - Return boolean `isMobile` state that updates on window changes
  - Add `useEffect` to listen for media query changes (handles iPad rotation, external mouse)
  - Success criteria: Hook returns `true` on iPhone/Android, `false` on desktop with mouse

- [ ] Create `hooks/use-web-share.ts` for Web Share API capability detection
  - Check `navigator.share` availability and `navigator.canShare()` support
  - Return `{ isSupported: boolean, canShareFiles: boolean }` object
  - Handle SSR (return `false` when `window` undefined)
  - Success criteria: Returns correct capabilities across browsers - iOS Safari supports files, desktop Chrome varies

### 2. Upgrade Share Button with Native Share

- [ ] Update `components/library/share-button.tsx` to support Web Share API
  - Import `use-web-share` hook to detect capability
  - Add new async function `handleNativeShare()` that:
    1. Fetches image blob from `asset.blobUrl` using `fetch()`
    2. Converts blob to `File` object with proper MIME type and filename
    3. Calls `navigator.share({ files: [file], title: filename, url: shareUrl })`
    4. Handles `AbortError` (user cancelled) silently
    5. Handles `NotAllowedError` with user-friendly toast
  - Modify `handleShare()` to branch:
    - If `isWebShareSupported && isMobile`: call `handleNativeShare()`
    - Else: fall back to clipboard copy (existing behavior)
  - Update success toast: "Opened share sheet" for native, "Link copied" for clipboard
  - Technical note: Web Share requires user gesture - already satisfied by onClick
  - Success criteria: iOS shows native share sheet with image preview, desktop copies to clipboard

### 3. Fix Image Tile Action Buttons for Touch

- [ ] Update `components/library/image-tile.tsx` to show buttons on mobile
  - Import `use-is-mobile` hook at component top
  - Locate share button (line ~490-500) with `opacity-0 group-hover:opacity-100` classes
  - Locate delete button (line ~503-515) with same classes
  - Replace conditional opacity classes:
    - Desktop (has hover): `hover:opacity-0 hover:group-hover:opacity-100`
    - Mobile (no hover): Always visible, remove opacity classes
  - Implementation approach: Use Tailwind's arbitrary variants: `[.no-hover_&]:opacity-100`
  - Alternative: Use conditional className with `isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'`
  - Ensure transitions remain smooth: keep `transition-all` class
  - Success criteria: Share/delete buttons visible on iPhone without any tap, hidden on desktop until hover

- [ ] Add CSS media query classes to `app/globals.css` for hover detection
  - Add rule: `@media (hover: none) { .no-hover { /* marker class */ } }`
  - Add to body or root element to enable descendant selectors
  - Allows Tailwind arbitrary variant `[.no-hover_&]` to work correctly
  - Success criteria: `.no-hover` class present on touch devices, absent on desktop

### 4. Add Action Bar to Fullscreen Modal

- [ ] Add action buttons to fullscreen modal in `app/app/page.tsx`
  - Locate selectedAsset modal rendering (lines 738-783)
  - Add action bar container after image, before metadata overlay:
    ```tsx
    <div className="absolute bottom-20 left-4 right-4 flex items-center justify-center gap-3 bg-black/50 backdrop-blur-sm p-3 rounded-lg">
    ```
  - Add three buttons: Favorite, Share, Delete
  - Favorite button:
    - Use `Heart` icon from lucide-react
    - Wire to same `handleFavoriteToggle` logic as tiles (need to extract or duplicate)
    - Show filled heart if `selectedAsset.favorite === true`
    - Color: green when favorited, muted when not
  - Share button:
    - Use `ShareButton` component with `assetId={selectedAsset.id}`
    - Pass `variant="ghost"` and `size="icon"` props
    - Button should work identically to grid tile share
  - Delete button:
    - Use `Trash2` icon from lucide-react
    - Wire to delete confirmation modal (same as tiles)
    - Show confirmation before deleting
    - After delete: close modal (`setSelectedAsset(null)`)
  - Style all buttons consistently: white text, semi-transparent background, hover effects
  - Success criteria: All three actions work in fullscreen modal, buttons visible without hover

- [ ] Extract favorite toggle logic to reusable function in `app/app/page.tsx`
  - Current `handleFavoriteToggle` in ImageTile makes API call
  - Create `handleModalFavoriteToggle` in page component:
    - Takes `assetId` and current `favorite` state
    - Calls `/api/assets/[id]` PATCH endpoint
    - Updates `selectedAsset` state with new favorite value
    - Also triggers `updateAsset()` to sync grid
  - Success criteria: Favoriting in modal updates both modal and grid state

### 5. Handle Share Edge Cases

- [ ] Add error handling for blob fetch failures in share flow
  - In `handleNativeShare()`, wrap `fetch(asset.blobUrl)` in try-catch
  - If fetch fails (404, network error):
    - Show toast: "Couldn't load image for sharing"
    - Log error to console with asset ID for debugging
    - Don't call `navigator.share()`
  - If blob conversion fails (invalid MIME):
    - Fallback to sharing just the URL without file
    - Call `navigator.share({ url: shareUrl, title: filename })`
  - Success criteria: Share gracefully degrades if image unavailable

- [ ] Add loading state to ShareButton during native share
  - Add `isSharing` state variable
  - Show loading spinner while fetching blob
  - Disable button during share process
  - Reset state after share completes or fails
  - Success criteria: Button shows loading feedback, prevents double-tap

## Testing Checklist

After implementation, verify:
- [ ] Test on iOS Safari: share button opens native sheet with image
- [ ] Test on Android Chrome: share button works (may not support files)
- [ ] Test on desktop: share button copies link to clipboard
- [ ] Test on mobile: share/delete buttons always visible in grid
- [ ] Test on desktop: share/delete buttons only show on hover
- [ ] Test fullscreen modal: all three action buttons work
- [ ] Test fullscreen modal: favoriting updates grid in background
- [ ] Test error cases: network failure, permissions denied
