# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sploot is a **Vercel-first meme library with text→image semantic search** - a private, personal collection tool for storing, browsing, and semantically searching meme images using natural language queries.

## Technology Stack

### Core Technologies
- **Next.js** (App Router) with TypeScript
- **Vercel** ecosystem (Blob storage, Postgres/Neon with pgvector, deployment)
- **Clerk** for authentication (Google/Apple + magic link)
- **CLIP/SigLIP** embeddings via external API for semantic search
- **Tailwind CSS** with custom design tokens
- **PWA** capabilities for installable web app

## Development Commands

```bash
# Initial Setup (when implemented)
pnpm install              # Install dependencies
pnpm dev                  # Start development server on http://localhost:3000
pnpm build                # Build for production
pnpm start                # Start production server
pnpm lint                 # Run ESLint
pnpm type-check          # Run TypeScript type checking

# Database (once configured)
pnpm db:migrate          # Run database migrations
pnpm db:seed             # Seed development data
pnpm db:reset            # Reset database

# Testing (when implemented)
pnpm test                # Run all tests
pnpm test:unit           # Run unit tests
pnpm test:e2e            # Run end-to-end tests
```

## Architecture

### Key Directories
- `/app` - Next.js app router pages and API routes
- `/components` - React components (search bar, image grid, upload zone)
- `/lib` - Core utilities (embeddings, database, storage, auth)
- `/public` - Static assets and PWA manifest
- `/styles` - Global styles and Tailwind configuration

### Core Services
- **Embedding Service**: External API for CLIP/SigLIP text and image embeddings
- **Storage**: Vercel Blob for image files
- **Database**: Vercel Postgres with pgvector extension for similarity search
- **Auth**: Clerk for user authentication and session management

### Database Schema
```sql
-- users: Managed by Clerk
-- assets: Image metadata (id, user_id, blob_url, filename, size, created_at)
-- asset_embeddings: Vector embeddings for search (asset_id, embedding vector[512])
-- tags: Optional tagging system
-- asset_tags: Many-to-many relationship
```

### API Routes Structure
- `/api/upload` - Handle image uploads and processing
- `/api/search` - Semantic search with text queries
- `/api/assets` - CRUD operations for user's images
- `/api/embeddings` - Generate embeddings for text/images

## Design System

### Theme Configuration
- **Primary**: Neon Violet (#7C5CFF)
- **Accent**: Lime Pop (#BAFF39)
- **Background**: Deep Lab (#0A0B0D → #0F1012)
- **Typography**: Geist Sans font family
- **Spacing**: 4px base unit system

### Component Patterns
- Use shadcn/ui component patterns when applicable
- Follow "Crisp Lab Minimal" aesthetic from AESTHETIC.md
- Dark mode first with high contrast
- Subtle animations (200-300ms transitions)

## Performance Requirements

### SLOs (Service Level Objectives)
- **Upload processing**: < 2.5 seconds
- **Search response**: < 500ms
- **Initial page load**: < 1.5 seconds
- **Image grid render**: < 300ms for 100 images

### Optimization Strategies
- Lazy loading for image grids
- Virtual scrolling for large collections
- Edge caching for embeddings
- Optimistic UI updates

## Development Milestones

Currently implementing milestone-based development:
- **M0**: Skeleton app with auth setup
- **M1**: Upload functionality with Vercel Blob
- **M2**: Embeddings and semantic search
- **M3**: Polish features (favorites, PWA, keyboard shortcuts)
- **M4**: Hardening and optimization

## Key Implementation Notes

### Authentication
- Use Clerk's React hooks for auth state
- Protect all API routes with auth middleware
- Single-user private library (no sharing initially)

### Image Processing
- Resize on upload to max 2048px longest edge
- Generate thumbnails for grid view
- Support formats: JPEG, PNG, WebP, GIF
- Max file size: 10MB

### Search Implementation
- Text embeddings via external API (not self-hosted)
- pgvector for similarity search (cosine distance)
- Client-side caching of recent searches
- Debounced search input (300ms)

### PWA Requirements
- Service worker for offline caching
- App manifest with icons
- Install prompt on mobile/desktop
- Offline fallback pages

## Testing Strategy

### Unit Tests
- Components with React Testing Library
- API routes with mock dependencies
- Utility functions with Jest

### E2E Tests
- Critical user flows with Playwright
- Upload → Search → View flow
- Auth flow testing
- PWA installation

## Deployment

### Environment Variables
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Embeddings API
EMBEDDINGS_API_KEY=
EMBEDDINGS_API_URL=
```

### Vercel Configuration
- Auto-deploy from main branch
- Preview deployments for PRs
- Environment variables per environment
- Edge functions for API routes

## Security Considerations

- All assets are private to the authenticated user
- Implement rate limiting on upload/search endpoints
- Validate file types and sizes on upload
- Sanitize filenames and metadata
- Use signed URLs for blob storage access