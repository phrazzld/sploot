import { NextRequest } from 'next/server';

describe('E2E: user journey in mock mode', () => {
  let uploadUrlPOST: any;
  let assetsPOST: any;
  let assetsGET: any;
  let assetPATCH: any;
  let searchPOST: any;
  let resetMockStore: () => void;

  beforeEach(async () => {
    jest.resetModules();
    process.env.ENABLE_MOCK_SERVICES = 'true';
    process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES = 'true';

    ({ resetMockStore } = await import('@/lib/mock-store'));
    resetMockStore();

    ({ POST: uploadUrlPOST } = await import('@/app/api/upload-url/route'));
    const assetsModule = await import('@/app/api/assets/route');
    assetsPOST = assetsModule.POST;
    assetsGET = assetsModule.GET;
    ({ PATCH: assetPATCH } = await import('@/app/api/assets/[id]/route'));
    ({ POST: searchPOST } = await import('@/app/api/search/route'));
  });

  const createRequest = (
    method: string,
    body?: Record<string, unknown> | null,
    searchParams?: Record<string, string>
  ) => {
    const url = new URL('http://localhost/api/test');
    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    const request = new NextRequest(url, init as any);

    if (body && method !== 'GET') {
      (request as any).json = async () => body;
    }

    return request;
  };

  it('allows upload, favorite toggling, and semantic search', async () => {
    // Step 1: request upload URL
    const uploadReq = createRequest('POST', {
      filename: 'journey-happy-cat.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    });

    const uploadRes = await uploadUrlPOST(uploadReq);
    expect(uploadRes.status).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.pathname).toBeDefined();

    // Step 2: finalize asset creation
    const createAssetReq = createRequest('POST', {
      blobUrl: uploadData.uploadUrl ?? `https://mock-blob-storage.local/${uploadData.pathname}`,
      pathname: uploadData.pathname,
      filename: 'journey-happy-cat.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      checksum: 'journey-checksum-123',
      width: 640,
      height: 480,
    });

    const assetRes = await assetsPOST(createAssetReq);
    expect(assetRes.status).toBe(200);
    const assetData = await assetRes.json();
    const assetId = assetData.asset?.id;
    expect(assetId).toBeDefined();

    // Step 3: ensure asset visible in library
    const listReq = createRequest('GET', null, { limit: '50' });
    const listRes = await assetsGET(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.assets.some((asset: any) => asset.id === assetId)).toBe(true);

    // Step 4: favorite the uploaded asset
    const favoriteReq = createRequest('PATCH', { favorite: true });
    const favoriteRes = await assetPATCH(favoriteReq, { params: Promise.resolve({ id: assetId }) });
    expect(favoriteRes.status).toBe(200);
    const favoriteData = await favoriteRes.json();
    expect(favoriteData.asset.favorite).toBe(true);

    // Step 5: fetch favorites only
    const favoritesListReq = createRequest('GET', null, { favorite: 'true' });
    const favoritesListRes = await assetsGET(favoritesListReq);
    expect(favoritesListRes.status).toBe(200);
    const favoritesList = await favoritesListRes.json();
    expect(favoritesList.assets.some((asset: any) => asset.id === assetId)).toBe(true);

    // Step 6: search for the asset
    const searchReq = createRequest('POST', {
      query: 'journey-happy-cat',
      limit: 10,
      threshold: 0.2,
    });

    const searchRes = await searchPOST(searchReq);
    expect(searchRes.status).toBe(200);
    const searchData = await searchRes.json();
    expect(searchData.results.length).toBeGreaterThan(0);
    expect(searchData.results.some((result: any) => result.id === assetId)).toBe(true);
    expect(searchData.query).toBe('journey-happy-cat');
  });
});
