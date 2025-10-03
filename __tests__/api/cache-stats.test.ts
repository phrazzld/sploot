import { GET, POST } from '@/app/api/cache/stats/route';
import { createMockRequest, mockMultiLayerCache } from '../utils/test-helpers';
import { auth } from '@clerk/nextjs/server';
import { createMultiLayerCache, getMultiLayerCache } from '@/lib/multi-layer-cache';

// Mock dependencies
vi.mock('@clerk/nextjs/server');
vi.mock('@/lib/multi-layer-cache');

const mockAuth = vi.mocked(auth);
const mockCreateMultiLayerCache = vi.mocked(createMultiLayerCache);
const mockGetMultiLayerCache = vi.mocked(getMultiLayerCache);

describe('/api/cache/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockCache = mockMultiLayerCache();
    mockCreateMultiLayerCache.mockReturnValue(mockCache);
    mockGetMultiLayerCache.mockReturnValue(mockCache);
  });

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return cache statistics', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getStats.mockReturnValue({
        l1Hits: 100,
        l1Misses: 20,
        l2Hits: 50,
        l2Misses: 10,
        totalRequests: 180,
        hitRate: 83.33,
        avgLatency: 5.2,
        lastReset: new Date('2024-01-01'),
      });
      mockCache.isHealthy.mockResolvedValue({
        l1: true,
        l2: true,
        stats: {
          l1Hits: 100,
          l1Misses: 20,
          l2Hits: 50,
          l2Misses: 10,
          totalRequests: 180,
          hitRate: 83.33,
          avgLatency: 5.2,
          lastReset: new Date('2024-01-01'),
        },
      });
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.layers.l1.status).toBe('active');
      expect(data.layers.l1.hits).toBe(100);
      expect(data.layers.l1.misses).toBe(20);
      expect(data.layers.l2.status).toBe('active');
      expect(data.layers.l2.hits).toBe(50);
      expect(data.overall.totalRequests).toBe(180);
      expect(data.overall.hitRate).toBe('83.33%');
      expect(data.performance.meetsTarget).toBe(true);
      expect(data.performance.targetHitRate).toBe('80%');
    });

    it('should handle inactive cache layers', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.isHealthy.mockResolvedValue({
        l1: true,
        l2: false,
        stats: mockCache.getStats(),
      });
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.layers.l1.status).toBe('active');
      expect(data.layers.l2.status).toBe('inactive');
    });

    it('should indicate when cache performance is below target', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      mockCache.getStats.mockReturnValue({
        l1Hits: 50,
        l1Misses: 50,
        l2Hits: 20,
        l2Misses: 30,
        totalRequests: 150,
        hitRate: 46.67,
        avgLatency: 10.5,
        lastReset: new Date(),
      });
      mockCache.isHealthy.mockResolvedValue({
        l1: true,
        l2: true,
        stats: mockCache.getStats(),
      });
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.performance.meetsTarget).toBe(false);
      expect(data.performance.currentHitRate).toBe('46.67%');
    });
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('POST', null, {}, {
        action: 'reset-stats',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reset cache statistics', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', null, {}, {
        action: 'reset-stats',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Cache statistics reset successfully');
      expect(mockCache.resetStats).toHaveBeenCalled();
    });

    it('should clear L1 cache', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', null, {}, {
        action: 'clear-l1',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('L1 cache cleared successfully');
      expect(mockCache.clearL1Cache).toHaveBeenCalled();
    });

    it('should clear L2 cache', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', null, {}, {
        action: 'clear-l2',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('L2 cache cleared successfully');
      expect(mockCache.clearL2Cache).toHaveBeenCalled();
    });

    it('should clear all caches', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', null, {}, {
        action: 'clear-all',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('All caches cleared successfully');
      expect(mockCache.clearAllCaches).toHaveBeenCalled();
    });

    it('should start cache warming', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', null, {}, {
        action: 'warm',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Cache warming started');
      expect(data.userId).toBe('test-user-id');
      expect(mockCache.startAutoWarming).toHaveBeenCalledWith('test-user-id');
    });

    it('should invalidate user cache', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const mockCache = mockMultiLayerCache();
      getMultiLayerCache.mockReturnValue(mockCache);

      const request = createMockRequest('POST', null, {}, {
        action: 'invalidate',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('User cache invalidated');
      expect(data.userId).toBe('test-user-id');
      expect(mockCache.invalidateUserData).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 400 for invalid action', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', null, {}, {
        action: 'invalid-action',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid action');
    });
  });
});