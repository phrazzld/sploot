/**
 * Upload Queue Persistence Manager
 * Persists pending uploads to IndexedDB for recovery after interruptions
 */

interface PersistedUpload {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  lastModified: number;
  fileData: ArrayBuffer; // Store file content as ArrayBuffer
  addedAt: number;
  status: 'pending' | 'uploading' | 'failed';
  error?: string;
  retryCount: number;
}

interface UploadRecoveryOptions {
  onResumePrompt?: (uploads: PersistedUpload[]) => boolean | Promise<boolean>;
  autoResumeDelay?: number; // ms, defaults to 3000
  maxRetries?: number; // defaults to 3
}

/**
 * Manages upload persistence using IndexedDB
 */
export class UploadQueueManager {
  private static instance: UploadQueueManager | null = null;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'sploot_uploads';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'pending_uploads';
  private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): UploadQueueManager {
    if (!UploadQueueManager.instance) {
      UploadQueueManager.instance = new UploadQueueManager();
    }
    return UploadQueueManager.instance;
  }

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.db) return;

    // Check if IndexedDB is available
    if (!('indexedDB' in window)) {
      console.warn('[UploadQueue] IndexedDB not available, upload recovery disabled');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[UploadQueue] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[UploadQueue] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * Add a file to the persisted upload queue
   */
  async addUpload(file: File): Promise<string> {
    if (!this.db) {
      await this.init();
      if (!this.db) return file.name; // Fallback if DB not available
    }

    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Convert File to ArrayBuffer for storage
    const arrayBuffer = await file.arrayBuffer();

    const upload: PersistedUpload = {
      id,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      lastModified: file.lastModified,
      fileData: arrayBuffer,
      addedAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.add(upload);

      request.onsuccess = () => {
        console.log(`[UploadQueue] Persisted upload: ${file.name}`);
        resolve(id);
      };

      request.onerror = () => {
        console.error('[UploadQueue] Failed to persist upload:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update upload status
   */
  async updateUploadStatus(
    id: string,
    status: PersistedUpload['status'],
    error?: string
  ): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const upload = getRequest.result;
        if (!upload) {
          resolve();
          return;
        }

        upload.status = status;
        if (error) upload.error = error;
        if (status === 'failed') upload.retryCount++;

        const updateRequest = store.put(upload);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Remove successfully uploaded file
   */
  async removeUpload(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[UploadQueue] Removed persisted upload: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[UploadQueue] Failed to remove upload:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending uploads
   */
  async getPendingUploads(): Promise<PersistedUpload[]> {
    if (!this.db) {
      await this.init();
      if (!this.db) return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const uploads = request.result || [];
        const cutoffTime = Date.now() - this.MAX_AGE_MS;

        // Filter out old uploads and those that have been retried too many times
        const validUploads = uploads.filter(upload =>
          upload.addedAt > cutoffTime &&
          upload.retryCount < 3 &&
          (upload.status === 'pending' || upload.status === 'uploading' || upload.status === 'failed')
        );

        // Clean up old uploads
        this.cleanupOldUploads(uploads, validUploads);

        resolve(validUploads);
      };

      request.onerror = () => {
        console.error('[UploadQueue] Failed to get pending uploads:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Convert persisted upload back to File object
   */
  async toFile(upload: PersistedUpload): Promise<File> {
    const blob = new Blob([upload.fileData], { type: upload.mimeType });
    return new File([blob], upload.filename, {
      type: upload.mimeType,
      lastModified: upload.lastModified,
    });
  }

  /**
   * Clean up old or excessively retried uploads
   */
  private async cleanupOldUploads(
    allUploads: PersistedUpload[],
    validUploads: PersistedUpload[]
  ): Promise<void> {
    if (!this.db) return;

    const toDelete = allUploads.filter(u => !validUploads.includes(u));
    if (toDelete.length === 0) return;

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);

    toDelete.forEach(upload => {
      store.delete(upload.id);
      console.log(`[UploadQueue] Cleaned up old upload: ${upload.filename}`);
    });
  }

  /**
   * Clear all persisted uploads
   */
  async clearAll(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[UploadQueue] Cleared all persisted uploads');
        resolve();
      };

      request.onerror = () => {
        console.error('[UploadQueue] Failed to clear uploads:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check for and handle interrupted uploads on page load
   */
  async checkForInterruptedUploads(
    options: UploadRecoveryOptions = {}
  ): Promise<File[]> {
    const {
      onResumePrompt,
      autoResumeDelay = 3000,
      maxRetries = 3,
    } = options;

    const pendingUploads = await this.getPendingUploads();

    if (pendingUploads.length === 0) {
      return [];
    }

    console.log(`[UploadQueue] Found ${pendingUploads.length} interrupted uploads`);

    // If there's a custom prompt handler, use it
    if (onResumePrompt) {
      const shouldResume = await onResumePrompt(pendingUploads);
      if (!shouldResume) {
        // User declined, optionally clear the uploads
        // await this.clearAll();
        return [];
      }
    } else {
      // Default behavior: Show notification and auto-resume
      if (typeof window !== 'undefined') {
        this.showRecoveryNotification(pendingUploads.length, autoResumeDelay);

        // Wait for auto-resume delay
        await new Promise(resolve => setTimeout(resolve, autoResumeDelay));
      }
    }

    // Convert persisted uploads back to Files
    const files: File[] = [];
    for (const upload of pendingUploads) {
      try {
        const file = await this.toFile(upload);
        files.push(file);

        // Update status to uploading
        await this.updateUploadStatus(upload.id, 'uploading');
      } catch (error) {
        console.error(`[UploadQueue] Failed to restore upload ${upload.filename}:`, error);
        await this.updateUploadStatus(upload.id, 'failed', String(error));
      }
    }

    return files;
  }

  /**
   * Show recovery notification (can be customized)
   */
  private showRecoveryNotification(count: number, autoResumeMs: number): void {
    // This would integrate with your toast/notification system
    console.log(`[UploadQueue] Resuming ${count} interrupted uploads in ${autoResumeMs/1000}s...`);

    // If you have a toast system available, use it:
    // showToast(
    //   `Found ${count} interrupted upload${count > 1 ? 's' : ''}. Resuming in ${autoResumeMs/1000}s...`,
    //   'info'
    // );
  }

  /**
   * Get upload statistics
   */
  async getStats(): Promise<{
    pending: number;
    uploading: number;
    failed: number;
    total: number;
  }> {
    const uploads = await this.getPendingUploads();

    return {
      pending: uploads.filter(u => u.status === 'pending').length,
      uploading: uploads.filter(u => u.status === 'uploading').length,
      failed: uploads.filter(u => u.status === 'failed').length,
      total: uploads.length,
    };
  }
}

// Singleton instance getter
let queueManagerInstance: UploadQueueManager | null = null;

export function getUploadQueueManager(): UploadQueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = UploadQueueManager.getInstance();
  }
  return queueManagerInstance;
}

/**
 * Hook helper for React components
 */
export function useUploadRecovery(
  onFilesRecovered?: (files: File[]) => void,
  options?: UploadRecoveryOptions
): {
  checking: boolean;
  recoveredCount: number;
} {
  const [checking, setChecking] = useState(true);
  const [recoveredCount, setRecoveredCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const checkUploads = async () => {
      try {
        const manager = getUploadQueueManager();
        await manager.init();

        const files = await manager.checkForInterruptedUploads(options);

        if (mounted) {
          setRecoveredCount(files.length);
          setChecking(false);

          if (files.length > 0 && onFilesRecovered) {
            onFilesRecovered(files);
          }
        }
      } catch (error) {
        console.error('[UploadRecovery] Failed to check for interrupted uploads:', error);
        if (mounted) {
          setChecking(false);
        }
      }
    };

    checkUploads();

    return () => {
      mounted = false;
    };
  }, []); // Run once on mount

  return { checking, recoveredCount };
}

// React import for hooks
import { useState, useEffect } from 'react';