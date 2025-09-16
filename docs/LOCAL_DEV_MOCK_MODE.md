# Local Mock Mode

Sploot now ships with a mock service layer so you can run the app without Clerk, Vercel Blob, Postgres, Replicate, or Upstash credentials. This mode activates automatically when any of those secrets are missing (or when `NEXT_PUBLIC_ENABLE_MOCK_SERVICES=true`).

## What Works
- Automatic sign-in as a demo user with a seeded meme library
- Upload flow with in-memory storage, checksum dedupe, and optimistic UI
- Semantic search endpoints backed by deterministic mock embeddings
- Favorites, tagging, and deletion using in-memory persistence
- Search suggestions and cache APIs returning mock statistics

## Limitations
- No data persists between server restarts
- Upload URLs are placeholders; files stay client-side only
- Embedding vectors and search relevance are approximate demos
- Clerk sign-in/up pages redirect to a "demo workspace" entry point

## Switching to Real Services
1. Provision the real integrations (Clerk, Blob, Postgres, Replicate, Upstash) and add credentials to `.env.local`.
2. Set `NEXT_PUBLIC_ENABLE_MOCK_SERVICES=false` (or remove the override) and restart `pnpm dev`.
3. The app will automatically switch back to live services and Prisma persistence.
