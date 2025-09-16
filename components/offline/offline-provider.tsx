'use client';

import { ReactNode } from 'react';
import { OfflineBanner } from './offline-banner';
import { UploadQueueDisplay } from './upload-queue-display';
import { useUploadQueue } from '@/hooks/use-upload-queue';

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const { queue, removeFromQueue, updateQueueItem } = useUploadQueue();

  const handleRetry = (id: string) => {
    updateQueueItem(id, { status: 'queued', retryCount: 0 });
  };

  return (
    <>
      {children}
      <OfflineBanner />
      <UploadQueueDisplay
        queue={queue}
        onRemove={removeFromQueue}
        onRetry={handleRetry}
      />
    </>
  );
}