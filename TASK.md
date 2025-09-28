# TASK.md - Feed View Implementation

## Overview
Implement a third viewing mode ("feed") that displays memes in their full, uncropped glory in a vertical scrolling feed - optimized for browsing without clicking individual images.

## Core Implementation Tasks

### Phase 1: Foundation (MVP)

#### Type System & State Management
- [ ] Add 'feed' to ViewMode type in `/components/chrome/view-mode-toggle.tsx` - Update type definition from `'grid' | 'list'` to include `'feed'`
- [ ] Update view mode toggle UI to show third option with appropriate icon (newspaper/document icon suggested)
- [ ] Add URL parameter handling for `?view=feed` in `/app/app/page.tsx` - Ensure router state persistence
- [ ] Update localStorage persistence in view preferences hook to handle feed mode

#### Component Architecture
- [ ] Create `/components/library/image-feed.tsx` component file with TypeScript interfaces for props matching ImageGrid/ImageList pattern
- [ ] Define FeedItem sub-component structure with proper memoization for performance
- [ ] Implement virtual scrolling container using existing patterns from ImageGrid but adapted for variable height items
- [ ] Set up Intersection Observer for lazy loading with 3-item lookahead buffer

#### Layout Implementation
- [ ] Implement responsive container with max-width 720px on desktop, 100% on mobile with proper padding
- [ ] Create CSS module or Tailwind classes for feed-specific styles including smooth scroll behavior
- [ ] Add 32px vertical gap between items on desktop, 16px on mobile using CSS gap property
- [ ] Ensure proper aspect ratio preservation using Next.js Image component with fill+contain strategy

#### Image Display Logic
- [ ] Configure Next.js Image component to use full resolution URLs (not thumbnails) while maintaining lazy loading
- [ ] Implement progressive image loading with blur-up effect using placeholder="blur" if blur data available
- [ ] Add skeleton loader matching exact image dimensions to prevent layout shift
- [ ] Handle error states with retry button and fallback to next image

#### Basic Interactions
- [ ] Port favorite/heart button from ImageTile with identical positioning and behavior
- [ ] Implement click-to-lightbox using existing modal pattern from main page.tsx
- [ ] Add basic keyboard navigation: J (next), K (previous), L (like/favorite)
- [ ] Ensure proper focus management and keyboard trap handling

### Phase 2: Enhanced Features

#### Advanced Navigation
- [ ] Implement smooth scroll-to-item with `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- [ ] Add Space/Shift+Space navigation matching story-like UX patterns
- [ ] Create keyboard shortcut overlay (? key) showing all available commands
- [ ] Add support for Home/End keys to jump to first/last item
- [ ] Implement page up/down for faster browsing with 80% viewport scroll

#### Metadata & Actions
- [ ] Create metadata overlay component showing dimensions, file size, and date on hover/tap
- [ ] Add download button with proper filename preservation and browser compatibility
- [ ] Implement copy-to-clipboard functionality with success toast notification
- [ ] Add delete action with Shift+Click safety and confirmation modal reuse
- [ ] Show relevance scores when in search mode with proper threshold coloring

#### Mobile Optimizations
- [ ] Implement touch gestures: swipe up/down for navigation, double-tap to favorite
- [ ] Add pull-to-refresh functionality for feed refresh
- [ ] Create collapsible header that hides on scroll down, shows on scroll up
- [ ] Optimize image sizes for mobile bandwidth with srcSet configuration
- [ ] Add haptic feedback for actions on supported devices

#### Performance Optimizations
- [ ] Implement proper cleanup of off-screen images to prevent memory leaks
- [ ] Add request cancellation for images when scrolling quickly using AbortController
- [ ] Create efficient scroll position restoration when switching between views
- [ ] Add FPS monitoring in development mode to ensure 60fps scrolling
- [ ] Implement progressive enhancement for slower devices

### Phase 3: Advanced Features

#### Shuffle/Random Mode
- [ ] Add shuffle button to feed view controls with icon and tooltip
- [ ] Implement Fisher-Yates shuffle algorithm for random ordering
- [ ] Store shuffle seed in URL params for shareable random sequences
- [ ] Add "reshuffle" action to generate new random order
- [ ] Preserve shuffle state when switching views

#### Slideshow/Auto-play
- [ ] Create auto-advance timer with configurable duration (3-10 seconds)
- [ ] Add play/pause button with spacebar shortcut
- [ ] Implement progress indicator showing time until next advance
- [ ] Add speed controls (1x, 1.5x, 2x) for power users
- [ ] Pause on hover/interaction, resume after delay

#### Zoom & Pan
- [ ] Implement pinch-to-zoom on mobile using touch events
- [ ] Add click-and-drag panning for zoomed images
- [ ] Create zoom controls (+/-/reset) for desktop users
- [ ] Maintain zoom level per image in component state
- [ ] Add double-click to toggle between fit and full size

## Testing Checklist

### Functionality Tests
- [ ] Verify all three view modes switch correctly without data loss
- [ ] Test keyboard navigation works in all browsers
- [ ] Confirm lazy loading triggers at correct scroll positions
- [ ] Validate favorite/delete actions sync with backend
- [ ] Test URL parameter persistence across page refreshes

### Performance Tests
- [ ] Measure and optimize Time to First Meaningful Paint (<1s)
- [ ] Verify smooth 60fps scrolling with 100+ images
- [ ] Check memory usage doesn't exceed 100MB for 50 images
- [ ] Test with slow 3G network throttling
- [ ] Validate virtual scrolling properly recycles DOM nodes

### Cross-browser Tests
- [ ] Test in Chrome, Firefox, Safari, and Edge latest versions
- [ ] Verify mobile Safari quirks are handled (viewport, safe areas)
- [ ] Test with browser zoom at 67%, 100%, 150%, 200%
- [ ] Validate keyboard shortcuts don't conflict with browser defaults
- [ ] Check print layout degrades gracefully

### Accessibility Tests
- [ ] Verify full keyboard navigation without mouse
- [ ] Test with screen readers (NVDA, JAWS, VoiceOver)
- [ ] Validate focus indicators are always visible
- [ ] Check color contrast ratios meet WCAG AA standards
- [ ] Test with prefers-reduced-motion enabled

### Edge Cases
- [ ] Test with 0 images (empty state)
- [ ] Test with 1 image (ensure UI doesn't break)
- [ ] Test with 10,000 images (performance stress test)
- [ ] Handle mixed aspect ratios (portrait, landscape, square)
- [ ] Test with broken image URLs (error handling)
- [ ] Verify behavior with duplicate images
- [ ] Test rapid view switching doesn't cause crashes

## Success Criteria
- Feed view accessible via view toggle and URL parameter
- Images display at full size without cropping
- Smooth scrolling performance at 60fps
- All existing features (favorite, delete, search) work in feed view
- Mobile experience feels native and responsive
- No regression in grid or list view functionality
- Memory usage remains reasonable with large collections

## Implementation Notes
- Reuse existing components where possible (HeartIcon, DeleteConfirmationModal)
- Follow established patterns from ImageGrid and ImageList
- Maintain consistent styling with existing design system
- Use TypeScript strict mode and handle all edge cases
- Add proper error boundaries to prevent full app crashes
- Document keyboard shortcuts in help menu
- Consider feature flag for gradual rollout

## Dependencies
- Existing: Next.js Image, Tailwind CSS, React hooks
- Potentially needed: react-intersection-observer, react-virtual
- No new major dependencies should be required

## Timeline Estimate
- Phase 1 (MVP): 2 days
- Phase 2 (Enhanced): 1 day
- Phase 3 (Advanced): 1-2 days
- Testing & Polish: 1 day
- **Total: 5-6 days for full implementation**