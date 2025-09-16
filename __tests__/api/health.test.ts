import { GET } from '@/app/api/health/route';

describe('/api/health', () => {
  it('should return OK status', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('should include timestamp', async () => {
    const before = Date.now();
    const response = await GET();
    const data = await response.json();
    const after = Date.now();

    expect(data.timestamp).toBeDefined();
    const timestamp = new Date(data.timestamp).getTime();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});