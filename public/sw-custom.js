// Background Sync for Upload Queue
// This service worker handles background sync for failed uploads

// Register background sync when uploads fail
self.addEventListener('sync', async (event) => {
  if (event.tag === 'upload-queue') {
    event.waitUntil(processUploadQueue());
  }
});

// Process queued uploads by notifying the main app
// NOTE: Service workers can't easily use @vercel/blob/client SDK,
// so we just notify the main app to retry uploads using its secure flow
async function processUploadQueue() {
  try {
    // Get queued uploads from IndexedDB
    const queue = await getQueuedUploads();

    if (queue.length === 0) {
      console.log('[SW] No uploads in queue');
      return;
    }

    console.log(`[SW] Found ${queue.length} queued uploads, notifying main app`);

    // Filter uploads that need retry (not already successful, haven't exceeded retries)
    const uploadsToRetry = queue.filter(
      item => item.status !== 'success' && (item.retryCount || 0) < 3
    );

    if (uploadsToRetry.length === 0) {
      console.log('[SW] No uploads need retry');
      return;
    }

    // Notify all open clients to retry uploads
    // The main app will handle the actual upload using secure /api/upload/handle
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      console.log(`[SW] Notifying ${clients.length} clients to retry ${uploadsToRetry.length} uploads`);
      clients.forEach(client => {
        client.postMessage({
          type: 'RETRY_UPLOADS',
          uploads: uploadsToRetry,
        });
      });
    } else {
      console.log('[SW] No open clients to notify, uploads will retry when app reopens');
    }
  } catch (error) {
    console.error('[SW] Error processing upload queue:', error);
  }
}

// IndexedDB operations
const DB_NAME = 'sploot-uploads';
const DB_VERSION = 1;
const STORE_NAME = 'upload-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function getQueuedUploads() {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function updateQueueItem(id, updates) {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id);

    getRequest.onsuccess = (event) => {
      const item = event.target.result;
      if (item) {
        const updated = { ...item, ...updates, updatedAt: Date.now() };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = (event) => reject(event.target.error);
      } else {
        resolve(null);
      }
    };

    getRequest.onerror = (event) => reject(event.target.error);
  });
}

async function removeFromQueue(id) {
  const db = await openDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

// Helper function to convert base64 to blob
function base64ToBlob(base64Data) {
  try {
    // Remove data URL prefix if present
    const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');

    // Decode base64
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Detect MIME type from data URL or default to image/jpeg
    const mimeMatch = base64Data.match(/^data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('[SW] Error converting base64 to blob:', error);
    throw error;
  }
}

// Listen for messages from the client
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'queue-upload') {
    // Store the upload in IndexedDB
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const uploadData = {
      ...event.data.upload,
      status: 'queued',
      retryCount: 0,
      addedAt: Date.now(),
    };

    store.add(uploadData);

    // Register for background sync
    await self.registration.sync.register('upload-queue');

    event.ports[0].postMessage({ success: true });
  }

  if (event.data && event.data.type === 'check-queue') {
    const queue = await getQueuedUploads();
    event.ports[0].postMessage({ queue });
  }
});

// Periodic sync for retry (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'upload-retry') {
    event.waitUntil(processUploadQueue());
  }
});

console.log('[SW] Background sync for uploads initialized');