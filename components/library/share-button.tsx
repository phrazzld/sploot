'use client';

import { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useWebShare } from '@/hooks/use-web-share';
import { useIsMobile } from '@/hooks/use-is-mobile';

interface ShareButtonProps {
  assetId: string;
  blobUrl?: string;
  filename?: string;
  mimeType?: string;
  variant?: 'ghost' | 'default';
  size?: 'icon' | 'icon-sm';
  className?: string;
}

export function ShareButton({
  assetId,
  blobUrl,
  filename,
  mimeType,
  variant = 'ghost',
  size = 'icon-sm',
  className
}: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const { isSupported: isWebShareSupported, canShareFiles } = useWebShare();
  const isMobile = useIsMobile();

  /**
   * Handles native Web Share API sharing with image file.
   * Fetches the image blob, converts to File, and opens native share sheet.
   */
  const handleNativeShare = async (shareUrl: string): Promise<boolean> => {
    // Can't use native share without blob URL
    if (!blobUrl) {
      return false;
    }

    try {
      // Fetch the image blob
      const response = await fetch(blobUrl);
      if (!response.ok) {
        console.error(`[ShareButton] Failed to fetch blob for asset ${assetId}: ${response.status}`);
        toast.error("Couldn't load image for sharing");
        return false;
      }

      const blob = await response.blob();

      // Determine filename and MIME type
      const shareFilename = filename || `sploot-meme-${assetId.slice(0, 8)}.jpg`;
      const shareMimeType = mimeType || blob.type || 'image/jpeg';

      // Convert blob to File object
      const file = new File([blob], shareFilename, { type: shareMimeType });

      // Prepare share data
      const shareData: ShareData = {
        title: shareFilename,
        url: shareUrl,
      };

      // Add files if supported
      if (canShareFiles) {
        shareData.files = [file];
      }

      // Open native share sheet
      await navigator.share(shareData);

      toast.success('Share sheet opened');
      return true;
    } catch (error) {
      // User cancelled share (AbortError) - handle silently
      if (error instanceof Error && error.name === 'AbortError') {
        return true; // Success - user just cancelled
      }

      // Permission denied or not allowed error
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.error(`[ShareButton] Share not allowed for asset ${assetId}:`, error);
        toast.error('Share permission denied');
        return false;
      }

      // If blob conversion or file creation failed, try sharing just the URL
      if (!canShareFiles) {
        try {
          await navigator.share({ url: shareUrl, title: filename || 'Check out this meme' });
          toast.success('Share sheet opened');
          return true;
        } catch (fallbackError) {
          // Fallback also failed
          console.error(`[ShareButton] Native share failed for asset ${assetId}:`, fallbackError);
          return false;
        }
      }

      console.error(`[ShareButton] Native share failed for asset ${assetId}:`, error);
      return false;
    }
  };

  /**
   * Main share handler - branches between native share and clipboard fallback.
   */
  const handleShare = async () => {
    setLoading(true);
    try {
      // Generate share URL via API
      const res = await fetch(`/api/assets/${assetId}/share`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const { shareUrl } = await res.json();

      // Try native share on mobile if supported
      if (isWebShareSupported && isMobile && blobUrl) {
        const nativeShareSuccess = await handleNativeShare(shareUrl);
        if (nativeShareSuccess) {
          return; // Native share handled it
        }
        // Fall through to clipboard if native share failed
      }

      // Fallback: Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied! Share it with friends');
    } catch (error) {
      console.error('[ShareButton] Share failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      disabled={loading}
      aria-label="Share meme"
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </Button>
  );
}
