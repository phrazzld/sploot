const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function resolveModule(modulePath) {
  const absolute = path.resolve(rootDir, modulePath);
  return require(absolute);
}

async function seedMockAssets(count) {
  const { resetMockStore, mockCreateAsset } = resolveModule('lib/mock-store.ts');
  resetMockStore();

  const userId = 'mock-user-id';

  for (let i = 0; i < count; i++) {
    const filename = `stress-cat-${i}.jpg`;
    mockCreateAsset(userId, {
      blobUrl: `https://mock-blob-storage.local/${filename}`,
      pathname: `${userId}/${filename}`,
      filename,
      mime: 'image/jpeg',
      size: 512 * 1024,
      checksumSha256: randomUUID(),
      width: 640,
      height: 480,
    });
  }
}

async function timeUploadFlow(iterations) {
  const { POST: uploadUrlPOST } = resolveModule('app/api/upload-url/route.ts');
  const { POST: assetsPOST } = resolveModule('app/api/assets/route.ts');

  let total = 0;
  for (let i = 0; i < iterations; i++) {
    const filename = `perf-upload-${i}.jpg`;
    const start = performance.now();

    const uploadReq = new Request('http://localhost/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, mimeType: 'image/jpeg', size: 256000 }),
    });
    uploadReq.json = async () => ({ filename, mimeType: 'image/jpeg', size: 256000 });
    const uploadRes = await uploadUrlPOST(uploadReq);
    const uploadData = await uploadRes.json();

    const assetReq = new Request('http://localhost/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobUrl: uploadData.uploadUrl,
        pathname: uploadData.pathname,
        filename,
        mimeType: 'image/jpeg',
        size: 256000,
        checksum: randomUUID(),
        width: 400,
        height: 300,
      }),
    });
    assetReq.json = async () => ({
      blobUrl: uploadData.uploadUrl,
      pathname: uploadData.pathname,
      filename,
      mimeType: 'image/jpeg',
      size: 256000,
      checksum: randomUUID(),
      width: 400,
      height: 300,
    });
    await assetsPOST(assetReq);

    total += performance.now() - start;
  }
  return total / iterations;
}

async function timeSearchFlow(iterations) {
  const { POST: searchPOST } = resolveModule('app/api/search/route.ts');
  let total = 0;

  for (let i = 0; i < iterations; i++) {
    const query = `stress-cat-${Math.floor(Math.random() * 5000)}`;
    const start = performance.now();

    const searchReq = new Request('http://localhost/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 20, threshold: 0.2 }),
    });
    searchReq.json = async () => ({ query, limit: 20, threshold: 0.2 });
    await searchPOST(searchReq);

    total += performance.now() - start;
  }
  return total / iterations;
}

async function main() {
  process.env.ENABLE_MOCK_SERVICES = 'true';
  process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES = 'true';

  const assetCount = Number(process.argv[2] ?? 5000);
  const iterations = Number(process.argv[3] ?? 20);

  console.log(`Seeding ${assetCount} mock assets...`);
  await seedMockAssets(assetCount);

  console.log(`Running ${iterations} upload iterations...`);
  const uploadAvg = await timeUploadFlow(iterations);
  console.log(`Average upload flow: ${uploadAvg.toFixed(2)}ms`);

  console.log(`Running ${iterations} search iterations...`);
  const searchAvg = await timeSearchFlow(iterations);
  console.log(`Average search flow: ${searchAvg.toFixed(2)}ms`);

  const uploadSLO = uploadAvg <= 2500;
  const searchSLO = searchAvg <= 500;

  console.log('\nSLO Summary:');
  console.log(`- Upload < 2.5s: ${uploadSLO ? '✅' : '❌'} (${uploadAvg.toFixed(2)}ms)`);
  console.log(`- Search < 500ms: ${searchSLO ? '✅' : '❌'} (${searchAvg.toFixed(2)}ms)`);

  if (!uploadSLO || !searchSLO) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
