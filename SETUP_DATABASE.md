# Setting up Vercel Postgres with pgvector for Sploot

## Overview

Sploot uses PostgreSQL with the pgvector extension for storing image metadata and performing semantic similarity search on embeddings.

## Setup Instructions

### 1. Create Vercel Postgres Database

1. **Go to Vercel Dashboard**:
   - Navigate to your project
   - Click on the "Storage" tab
   - Click "Create Database"

2. **Select Postgres**:
   - Choose "Postgres" as the database type
   - Select your preferred region (closest to your users)
   - Name it (e.g., "sploot-db")

3. **Get Connection Strings**:
   After creation, you'll see two connection strings:
   - `POSTGRES_URL` - Pooled connection for serverless
   - `POSTGRES_URL_NON_POOLING` - Direct connection for migrations

### 2. Enable pgvector Extension

1. **Connect to your database**:
   - Click "Query" in the Vercel Postgres dashboard
   - Or use any PostgreSQL client with your connection string

2. **Enable pgvector**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 3. Configure Environment Variables

Add these to your `.env.local`:
```env
# From Vercel Postgres dashboard
POSTGRES_URL="postgres://default:xxxxx@xxx.neon.tech/verceldb?sslmode=require"
POSTGRES_URL_NON_POOLING="postgres://default:xxxxx@xxx.neon.tech/verceldb?sslmode=require"

# Optional: For Prisma Studio
DATABASE_URL="${POSTGRES_URL_NON_POOLING}"
```

### 4. Run Database Migrations

Once your database is configured:

```bash
# Generate Prisma Client
pnpm db:generate

# Run migrations (production)
pnpm db:migrate

# Or for development with migration file creation
pnpm db:migrate:dev

# Or push schema without migrations (development only)
pnpm db:push
```

### 5. Verify Setup

Test the database connection:
```bash
# Open Prisma Studio to view your database
pnpm db:studio
```

## Database Schema

The database includes these tables:

### Core Tables
- **users**: Synced with Clerk authentication
- **assets**: Image metadata and blob storage URLs
- **asset_embeddings**: Vector embeddings for semantic search
- **tags**: User-defined tags for organization
- **asset_tags**: Many-to-many relationship

### Indexes
- **HNSW index** on embeddings for fast similarity search
- **Unique constraint** on user + checksum to prevent duplicates
- **Standard indexes** on foreign keys and commonly queried fields

## pgvector Configuration

### HNSW Index Parameters
The migration creates an optimized HNSW index:
```sql
CREATE INDEX ON asset_embeddings
USING hnsw (image_embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 128);
```

- `m = 24`: Number of bi-directional links (higher = better recall, more memory)
- `ef_construction = 128`: Size of dynamic candidate list (higher = better quality, slower build)

### Query-time Optimization
For optimal search performance:
```sql
SET hnsw.ef_search = 100;  -- Adjust based on your needs
```

## Working with Vectors

### Storing Embeddings
Embeddings are stored as `vector` type:
```typescript
// Example: Store a 512-dimensional embedding
const embedding = new Array(512).fill(0.1); // Your actual embedding
const embeddingStr = `[${embedding.join(',')}]`;

await prisma.$executeRaw`
  INSERT INTO asset_embeddings (asset_id, image_embedding, ...)
  VALUES ($1, $2::vector, ...)
`, assetId, embeddingStr;
```

### Similarity Search
Using cosine distance (recommended for normalized embeddings):
```sql
SELECT * FROM assets a
JOIN asset_embeddings ae ON a.id = ae.asset_id
ORDER BY ae.image_embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

## Performance Considerations

### Connection Pooling
- Use `POSTGRES_URL` (pooled) for API routes
- Use `POSTGRES_URL_NON_POOLING` for migrations and long operations

### Scaling Limits
- pgvector works well up to ~5M vectors
- Beyond that, consider dedicated vector databases (Pinecone, Qdrant)

### Query Performance
- HNSW index provides sub-100ms queries for millions of vectors
- Keep `ef_search` between 50-200 for optimal speed/accuracy trade-off

## Troubleshooting

### "Extension 'vector' not found"
- Ensure you're using Vercel Postgres (Neon) which includes pgvector
- Run `CREATE EXTENSION vector;` as superuser

### "Column type vector not recognized"
- Run `pnpm db:generate` to regenerate Prisma Client
- Ensure `previewFeatures = ["postgresqlExtensions"]` in schema.prisma

### Slow similarity searches
- Check HNSW index exists: `\di asset_embeddings_hnsw_idx`
- Increase `ef_search` for better accuracy
- Consider reducing result limit

### Connection errors
- Verify environment variables are set correctly
- Check if database is running in Vercel Dashboard
- Ensure SSL mode is set (`?sslmode=require`)

## Maintenance

### Regular Tasks
1. **Monitor index performance**:
   ```sql
   SELECT * FROM pg_stat_user_indexes
   WHERE indexrelname LIKE '%hnsw%';
   ```

2. **Vacuum for performance**:
   ```sql
   VACUUM ANALYZE asset_embeddings;
   ```

3. **Check table sizes**:
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('asset_embeddings'));
   ```

## Next Steps

After database setup:
1. Implement the `/api/assets` endpoint (M1.4)
2. Set up Replicate for embeddings (M2.1)
3. Build search functionality (M2.3)