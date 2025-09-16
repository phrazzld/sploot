# Upstash Redis Setup Guide

This guide will help you set up Upstash Redis for caching in your Sploot application.

## Why Redis Caching?

Redis caching provides significant performance improvements for Sploot:

- **Text Embedding Cache**: Repeated search queries hit cache instead of expensive API calls
- **Image Embedding Cache**: Already processed images skip re-processing
- **Search Results Cache**: Popular searches return instantly
- **User Data Cache**: Faster dashboard loads and asset counts

**Expected Performance Impact:**
- Search latency: 500ms → 50ms (90% improvement for cached queries)
- API cost reduction: 60-80% for text embeddings
- Overall app responsiveness: 2-3x faster for repeat actions

## 1. Create Upstash Account

1. Go to [upstash.com](https://upstash.com)
2. Sign up for a free account
3. Verify your email address

## 2. Create Redis Database

1. **Click "Create Database"** in the Upstash dashboard
2. **Choose configuration**:
   - **Name**: `sploot-cache` (or your preferred name)
   - **Type**: Select **"Regional"** for better performance
   - **Region**: Choose the region closest to your Vercel deployment
   - **Eviction**: Select **"allkeys-lru"** (removes least recently used keys when full)

3. **Review settings**:
   - **Free tier**: 10,000 commands/day (sufficient for development)
   - **Pro tier**: Consider for production with heavy usage

4. **Click "Create"**

## 3. Get Connection Details

After database creation:

1. **Go to your database dashboard**
2. **Find the "REST API" section**
3. **Copy these values**:
   - `UPSTASH_REDIS_REST_URL` (e.g., `https://us1-xxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (e.g., `AAAxxxxxxx`)

## 4. Configure Environment Variables

Add the credentials to your `.env.local` file:

```env
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
```

**⚠️ Important**:
- Replace the example values with your actual credentials
- Never commit these credentials to version control
- Use different databases for development/staging/production

## 5. Deploy Environment Variables

### For Vercel Deployment:

1. **Go to your Vercel project dashboard**
2. **Navigate to Settings → Environment Variables**
3. **Add both variables**:
   - `UPSTASH_REDIS_REST_URL` = `https://your-redis-url.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` = `your_redis_token_here`
4. **Select environments**: Choose "Production", "Preview", and "Development"
5. **Click "Save"**

### For Local Development:

Environment variables in `.env.local` are automatically loaded by Next.js.

## 6. Verify Cache is Working

1. **Restart your development server**:
   ```bash
   pnpm dev
   ```

2. **Check the console logs** for cache initialization:
   ```
   Cache service initialized successfully
   ```

3. **Test caching functionality**:
   - Perform a search query twice
   - Look for console logs showing cache hits:
     ```
     Cache hit: text embedding for "funny cats..."
     ```

## 7. Production Considerations

### Database Scaling

**Free Tier Limits:**
- 10,000 commands/day
- 256 MB storage
- Perfect for development and small applications

**Upgrading:**
- Monitor usage in Upstash dashboard
- Consider Pro tier ($0.2 per 100K commands) for production
- Set up alerts for approaching limits

### Regional Performance

**Best Practices:**
- Use the same region as your Vercel deployment
- US East 1 (us-east-1) is often optimal for global applications
- Monitor latency and switch regions if needed

### Security

**Environment Management:**
- Use different Redis databases for different environments
- Rotate tokens periodically (every 90 days)
- Monitor access logs in Upstash dashboard

### Cache Strategy

**TTL (Time To Live) Settings:**
- Text embeddings: 15 minutes (queries may evolve)
- Image embeddings: 24 hours (images are immutable)
- Search results: 5 minutes (content changes with uploads)
- User metadata: 30 minutes (changes infrequently)

**Cache Invalidation:**
- User uploads automatically invalidate their search/asset caches
- Manual cache clearing available via API for admins

## 8. Monitoring & Debugging

### Cache Statistics

Access cache health at runtime:
```bash
# In browser console or API testing
fetch('/api/cache/stats')
```

**Response includes:**
- Cache service status (enabled/disabled)
- Connection health
- Hit/miss ratios (if available)

### Common Issues

**"Cache service disabled" message:**
- Check environment variables are set correctly
- Verify Redis URL format (must include https://)
- Confirm token is complete (they're quite long)

**Connection timeouts:**
- Check Upstash dashboard for service status
- Try different region if latency is high
- Verify network connectivity

**Missing cache hits:**
- Cache is automatically disabled if Redis fails
- Application continues working without cache
- Check console for specific error messages

## 9. Optional: Advanced Configuration

### Custom Cache Settings

You can customize cache behavior by modifying `lib/cache.ts`:

```typescript
// Adjust TTL values for your needs
const DEFAULT_TTL = {
  TEXT_EMBEDDING: 30 * 60, // 30 minutes instead of 15
  IMAGE_EMBEDDING: 7 * 24 * 60 * 60, // 7 days instead of 24 hours
  SEARCH_RESULTS: 10 * 60, // 10 minutes instead of 5
};
```

### Multiple Environments

For larger teams, consider separate Redis instances:

```env
# Development
UPSTASH_REDIS_REST_URL=https://dev-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=dev_token_here

# Production
UPSTASH_REDIS_REST_URL=https://prod-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=prod_token_here
```

## 10. Cost Optimization

### Free Tier Usage

**10,000 commands/day breakdown:**
- ~50 searches with cache misses = ~100 commands
- ~500 searches with cache hits = ~500 commands
- Leaves ~9,400 commands for other operations

**Optimization tips:**
- Cache hits use minimal commands (1 GET vs 1 SET + 1 GET for miss)
- Longer TTL = fewer cache refreshes = lower command usage
- Monitor usage patterns in Upstash dashboard

### Upgrading Strategy

**Consider upgrading when:**
- Approaching 8,000 commands/day consistently
- Response times degrade due to rate limiting
- Need higher storage for large embedding caches

---

## ✅ Completion Checklist

- [ ] Created Upstash account
- [ ] Created Redis database
- [ ] Added environment variables to `.env.local`
- [ ] Deployed variables to Vercel (if applicable)
- [ ] Verified cache service starts successfully
- [ ] Tested cache hits by repeating search queries
- [ ] Set up monitoring/alerts (optional)

## 🎯 Success Indicators

**Cache is working when you see:**
1. Console logs: "Cache service initialized successfully"
2. Console logs: "Cache hit: text embedding for..." on repeat searches
3. Noticeably faster search responses on repeated queries
4. Upstash dashboard showing command usage

## 🔗 Related Documentation

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## 🆘 Getting Help

**If you encounter issues:**
1. Check console logs for specific error messages
2. Verify all environment variables are set correctly
3. Test Redis connection in Upstash dashboard console
4. Check Upstash status page for service outages
5. Application will work without cache - it's a performance enhancement, not a requirement