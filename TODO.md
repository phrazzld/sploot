# Sploot TODO - Functional Prototype → Polished Product

## 🚀 CURRENT STATUS: Working Prototype

The app is **FUNCTIONAL** with all services configured. Upload works, search works, auth works. Now focusing on UI/UX polish.

---

## ✅ COMPLETED (Services Configured & Working)

- [x] **Clerk Authentication** - Working with Google/Email
- [x] **Vercel Postgres** - Database connected with pgvector
- [x] **Vercel Blob Storage** - Image uploads functional
- [x] **Replicate API** - Embeddings and search operational
- [x] **User Sync Fix** - Clerk users now properly sync to database
- [x] **Upload Error Handling** - Proper error reporting and cleanup

---

## 🎨 UI/UX Improvements (Current Focus)

### Phase 1: Remove Redundancy & Fix Grammar
- [x] **Remove redundant stat cards** (`app/app/page.tsx` lines 52-100)
  - Delete the 4 cards (Total, Favorites, Upload, Search)
  - They duplicate sidebar navigation and waste vertical space
  - Keep stats but integrate into header as inline text

- [x] **Fix singular/plural grammar** (`app/app/page.tsx` line 42)
  - Change: `${total} memes in your collection`
  - To: `${total} ${total === 1 ? 'meme' : 'memes'} in your collection`
  - Also update empty state text

- [x] **Clean up search bar purple accent** (`components/search/search-bar.tsx` line 60)
  - Remove the `<div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#7C5CFF] rounded-full" />`
  - Looks disconnected and out of place

- [x] **Remove keyboard hint** (`components/search/search-bar.tsx` lines 175-178)
  - Delete the "Press Enter to search" hint div
  - Unnecessary clutter, Enter is standard behavior

### Phase 2: Gallery Display Improvements
- [x] **Add view mode state** (`app/app/page.tsx`)
  - Add `const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'compact'>('grid')`
  - Store preference in localStorage: `localStorage.setItem('viewMode', viewMode)`
  - Load on mount: `useState(() => localStorage.getItem('viewMode') || 'grid')`

- [x] **Create view mode toggle buttons** (`app/app/page.tsx` header section)
  - Add button group with 3 icons: Grid, Masonry, List
  - Position: right side of header, inline with title
  - Active state: bg-[#7C5CFF]/20 with text-[#7C5CFF]

- [x] **Implement masonry layout** (`components/library/masonry-grid.tsx` - new file)
  - Use CSS columns for true masonry (no JS library needed)
  - Preserve original aspect ratios
  - Column count responsive: 2 → 3 → 4 → 5 → 6
  - Gap: 16px consistent with current design

- [x] **Update ImageTile for aspect ratio preservation** (`components/library/image-tile.tsx`)
  - Add prop: `preserveAspectRatio: boolean`
  - When true, remove `aspect-square` class from container
  - Use `object-contain` instead of `object-cover` for img

- [ ] **Simplify virtual scrolling logic** (`components/library/image-grid.tsx`)
  - Only enable virtualizer when `assets.length > 100`
  - Otherwise use SimpleImageGrid component
  - Reduces complexity for typical collections

### Phase 3: Enhanced Header Design
- [ ] **Redesign header with inline stats** (`app/app/page.tsx` lines 38-44)
  - Single line format: "247 memes • 12 favorites • 2.3GB"
  - Use subtle separators (•) not boxes
  - Text color: text-[#B3B7BE] for stats

- [ ] **Add sort/filter dropdown** (`app/app/page.tsx` header)
  - Position: right side below view toggle
  - Options: Date (newest/oldest), Favorites, Size, Name
  - Store preference in localStorage

- [ ] **Implement live search** (`components/search/search-bar.tsx`)
  - Add debounce hook: 300ms delay
  - Trigger search automatically on type
  - Remove Search button, just show loading spinner
  - Add ESC key handler to clear

### Phase 4: Polish & Animations
- [ ] **Add image fade-in animation** (`components/library/image-tile.tsx`)
  - Use `opacity-0 animate-fade-in` on img load
  - CSS animation: 200ms ease-out
  - Prevent layout shift during load

- [ ] **Smooth view mode transitions** (`app/app/page.tsx`)
  - Add `transition-all duration-300` to grid container
  - Use transform for smooth repositioning
  - Maintain scroll position between modes

- [ ] **Better empty state illustration** (`components/library/image-grid.tsx` lines 116-126)
  - Replace emoji with SVG illustration
  - Add "Drop files here" message
  - Include upload button directly in empty state

- [ ] **Loading skeleton for images** (`components/library/image-tile.tsx`)
  - Show animated placeholder while loading
  - Match final image dimensions to prevent jump
  - Subtle pulse animation

---

## 🔧 Technical Debt & Bug Fixes

### High Priority
- [ ] **Fix TypeScript errors in tests** (`__tests__/api/asset-crud.test.ts`)
  - Promise type mismatches on lines 62, 74, 89, 105, 121, 135
  - Update mock return types to match actual API

- [ ] **Add proper error boundaries**
  - Wrap ImageGrid in error boundary component
  - Show user-friendly error message
  - Include "Reload" action button

### Medium Priority
- [ ] **Implement image resize on upload** (`app/api/upload/route.ts`)
  - Use Sharp to resize images > 2048px
  - Generate thumbnail (256px) for grid view
  - Store both versions in Blob storage

- [ ] **Add delete confirmation dialog**
  - Replace `confirm()` with custom modal
  - Show image preview in confirmation
  - Add "Don't ask again" checkbox

- [ ] **Wire up duplicate detection** (`lib/db.ts` assetExists function)
  - Check checksum before upload
  - Show "This image already exists" message
  - Offer to view existing or upload anyway

### Low Priority
- [ ] **Add batch upload progress**
  - Show overall progress bar
  - Individual file status indicators
  - Cancel remaining uploads option

- [ ] **Implement tag system UI**
  - Add tag input to upload modal
  - Show tags in image tiles
  - Filter by tag in sidebar

---

## 📊 Success Metrics

### Current Sprint (UI Polish)
- [ ] Gallery shows images in their original aspect ratios (masonry mode)
- [ ] Can switch between view modes with one click
- [ ] Search updates results as you type (live search)
- [ ] No redundant UI elements visible
- [ ] Smooth animations on all interactions

### Next Sprint (Performance)
- [ ] Images load with fade-in animation
- [ ] Virtual scrolling works for 1000+ images
- [ ] Upload generates thumbnails automatically
- [ ] Page loads in < 1.5s
- [ ] Search returns results in < 300ms

---

## 🗓️ Timeline

**Week 1** (Current)
- Complete Phase 1 & 2 UI improvements
- Fix critical TypeScript errors
- Deploy and test

**Week 2**
- Complete Phase 3 & 4 UI improvements
- Add error boundaries
- Implement image resize

**Week 3**
- Polish animations
- Add duplicate detection
- Tag system UI

---

**Last Updated**: 2025-09-18
**Current Focus**: UI/UX Polish - Making the gallery beautiful and functional