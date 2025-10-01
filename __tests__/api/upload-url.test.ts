import { POST } from '@/app/api/upload-url/route';
import { createMockRequest } from '../utils/test-helpers';
import { put } from '@vercel/blob';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

const mockAuth = require('@clerk/nextjs/server').auth;
const mockPut = put as vi.MockedFunction<typeof put>;

describe('/api/upload-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = createMockRequest('POST', {
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if filename is missing', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        mimeType: 'image/jpeg',
        size: 1024000,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameters: filename, mimeType, size');
    });

    it('should return 400 if mimeType is missing', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        filename: 'test.jpg',
        size: 1024000,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameters: filename, mimeType, size');
    });

    it('should return 400 for invalid file type', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });

      const request = createMockRequest('POST', {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024000,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid file type');
    });

    it('should successfully generate upload URL for valid image', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      mockPut.mockResolvedValue({
        url: 'https://example.blob.vercel-storage.com/test-123.jpg',
        downloadUrl: 'https://example.blob.vercel-storage.com/test-123.jpg',
        pathname: 'test-123.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'inline',
      });

      const request = createMockRequest('POST', {
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBeDefined();
      expect(data.pathname).toBeDefined();
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('test.jpg'),
        expect.any(Object),
        expect.objectContaining({
          access: 'public',
          addRandomSuffix: true,
        })
      );
    });

    it('should handle different valid image types', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      mockPut.mockResolvedValue({
        url: 'https://example.blob.vercel-storage.com/test-123.png',
        downloadUrl: 'https://example.blob.vercel-storage.com/test-123.png',
        pathname: 'test-123.png',
        contentType: 'image/png',
        contentDisposition: 'inline',
      });

      const validTypes = [
        { filename: 'test.png', mimeType: 'image/png', size: 1024000 },
        { filename: 'test.webp', mimeType: 'image/webp', size: 1024000 },
        { filename: 'test.gif', mimeType: 'image/gif', size: 1024000 },
      ];

      for (const { filename, mimeType, size } of validTypes) {
        const request = createMockRequest('POST', {
          filename,
          mimeType,
          size,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBeDefined();
      }
    });

    it('should handle blob storage errors gracefully', async () => {
      mockAuth.mockResolvedValue({ userId: 'test-user-id' });
      mockPut.mockRejectedValue(new Error('Storage error'));

      const request = createMockRequest('POST', {
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024000,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate upload URL');
    });
  });
});