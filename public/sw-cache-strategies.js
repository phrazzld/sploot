// Advanced Service Worker Cache Strategies for Sploot
// Provides intelligent caching with adaptive strategies based on resource type and network conditions

// Cache version management
const CACHE_VERSION = 'v1';
const CACHE_PREFIX = 'sploot-';

// Cache names with versioning
const CACHE_NAMES = {
  PRECACHE: `${CACHE_PREFIX}precache-${CACHE_VERSION}`,
  RUNTIME: `${CACHE_PREFIX}runtime-${CACHE_VERSION}`,
  IMAGES: `${CACHE_PREFIX}images-${CACHE_VERSION}`,
  API: `${CACHE_PREFIX}api-${CACHE_VERSION}`,
};

// Resources to precache on install
const PRECACHE_RESOURCES = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - Precache critical resources
self.addEventListener('install', (event) => {
  console.log('[SW Cache] Installing with cache version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAMES.PRECACHE).then((cache) => {
      console.log('[SW Cache] Precaching critical resources');
      return cache.addAll(PRECACHE_RESOURCES).catch((error) => {
        console.warn('[SW Cache] Failed to precache some resources:', error);
        // Continue installation even if some resources fail
        return Promise.resolve();
      });
    })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW Cache] Activating with cache version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete caches that:
            // 1. Start with our prefix
            // 2. Don't match current version
            return cacheName.startsWith(CACHE_PREFIX) &&
                   !Object.values(CACHE_NAMES).includes(cacheName);
          })
          .map((cacheName) => {
            console.log('[SW Cache] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW Cache] Cleanup complete, claiming clients');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - Intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip cache for specific patterns
  if (shouldSkipCache(url)) {
    return;
  }

  // Apply appropriate caching strategy based on request type
  const strategy = determineStrategy(request, url);

  if (strategy) {
    event.respondWith(strategy(request));
  }
});

// Determine which caching strategy to use
function determineStrategy(request, url) {
  // Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    return networkFirstWithOfflineFallback;
  }

  // API requests
  if (url.pathname.startsWith('/api/')) {
    // Health check should always go to network
    if (url.pathname === '/api/health') {
      return null; // Let default fetch handle it
    }
    // Search requests - use cache with network update
    if (url.pathname.includes('/search')) {
      return staleWhileRevalidate;
    }
    // Other API requests - network first with cache fallback
    return networkFirstWithCache;
  }

  // Image requests
  if (isImageRequest(request)) {
    // User uploaded images from Vercel Blob
    if (url.hostname.includes('blob.vercel-storage.com')) {
      return cacheFirstWithNetworkFallback;
    }
    // Thumbnails - aggressive caching
    if (url.search.includes('thumb=true') || url.pathname.includes('thumb')) {
      return cacheFirstWithExpiry(7); // 7 days
    }
    // Other images
    return cacheFirstWithNetworkFallback;
  }

  // Static assets (JS, CSS)
  if (url.pathname.includes('/_next/static/')) {
    return cacheFirstWithNetworkFallback;
  }

  // Default strategy
  return staleWhileRevalidate;
}

// Strategy: Network first with offline fallback
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.RUNTIME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW Cache] Network failed, checking cache:', request.url);

    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline');
      if (offlinePage) {
        return offlinePage;
      }
    }

    // Return offline placeholder for images
    if (isImageRequest(request)) {
      const placeholderImage = await caches.match('/icons/icon-512x512.png');
      if (placeholderImage) {
        return placeholderImage;
      }
    }

    throw error;
  }
}

// Strategy: Cache first with network fallback
async function cacheFirstWithNetworkFallback(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached version immediately
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cacheName = isImageRequest(request) ? CACHE_NAMES.IMAGES : CACHE_NAMES.RUNTIME;
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW Cache] Network failed for:', request.url);
    throw error;
  }
}

// Strategy: Cache first with expiry
function cacheFirstWithExpiry(days) {
  return async function(request) {
    const cache = await caches.open(CACHE_NAMES.IMAGES);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Check if cache is still fresh
      const cachedDate = new Date(cachedResponse.headers.get('date'));
      const maxAge = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds

      if (Date.now() - cachedDate.getTime() < maxAge) {
        return cachedResponse;
      }
    }

    // Fetch from network and update cache
    try {
      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } catch (error) {
      // Return stale cache if available
      if (cachedResponse) {
        console.log('[SW Cache] Returning stale cache for:', request.url);
        return cachedResponse;
      }
      throw error;
    }
  };
}

// Strategy: Stale while revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAMES.RUNTIME);
  const cachedResponse = await cache.match(request);

  // Fetch in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((error) => {
    console.warn('[SW Cache] Background fetch failed:', error);
    return null;
  });

  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Wait for network if no cache
  const networkResponse = await fetchPromise;
  return networkResponse || new Response('Network error', { status: 503 });
}

// Strategy: Network first with cache fallback
async function networkFirstWithCache(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAMES.API);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW Cache] Network failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add header to indicate cached response
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache-Status', 'hit');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers,
      });
    }

    throw error;
  }
}

// Helper: Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();
  const acceptHeader = request.headers.get('Accept') || '';

  return pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|avif)$/i) ||
         acceptHeader.includes('image/');
}

// Helper: Check if URL should skip cache
function shouldSkipCache(url) {
  // Skip cache for:
  // - Chrome extensions
  // - Browser sync
  // - Hot reload
  // - Analytics
  const skipPatterns = [
    'chrome-extension://',
    'browser-sync',
    '__webpack_hmr',
    '_next/webpack-hmr',
    'google-analytics',
    'googletagmanager',
    'doubleclick.net',
  ];

  return skipPatterns.some(pattern => url.href.includes(pattern));
}

// Cache size management - Clean up when quota exceeded
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'clean-cache') {
    await cleanupCaches();
    event.ports[0].postMessage({ success: true });
  }

  if (event.data && event.data.type === 'cache-status') {
    const status = await getCacheStatus();
    event.ports[0].postMessage({ status });
  }
});

// Clean up old cache entries
async function cleanupCaches() {
  console.log('[SW Cache] Starting cache cleanup');

  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    if (!cacheName.startsWith(CACHE_PREFIX)) continue;

    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    // Sort by age and remove oldest entries
    const entriesToDelete = Math.floor(requests.length * 0.3); // Remove 30% oldest

    for (let i = 0; i < entriesToDelete; i++) {
      await cache.delete(requests[i]);
    }

    console.log(`[SW Cache] Cleaned ${entriesToDelete} entries from ${cacheName}`);
  }
}

// Get cache status information
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};

  for (const cacheName of cacheNames) {
    if (!cacheName.startsWith(CACHE_PREFIX)) continue;

    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    status[cacheName] = {
      count: requests.length,
      urls: requests.slice(0, 10).map(r => r.url), // First 10 URLs
    };
  }

  return status;
}

// Periodic cache maintenance
if (self.registration.periodicSync) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'cache-cleanup') {
      event.waitUntil(cleanupCaches());
    }
  });
}

console.log('[SW Cache] Advanced cache strategies loaded');