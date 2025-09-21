'use client';

import { ReactNode } from 'react';
import { OfflineStatusBar } from './offline-status-bar';
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
      <OfflineStatusBar />
      {children}
      <UploadQueueDisplay
        queue={queue}
        onRemove={removeFromQueue}
        onRetry={handleRetry}
      />
    </>
  );
}