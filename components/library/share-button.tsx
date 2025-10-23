'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareButtonProps {
  assetId: string;
  variant?: 'ghost' | 'default';
  size?: 'icon' | 'icon-sm';
  className?: string;
}

export function ShareButton({ assetId, variant = 'ghost', size = 'icon-sm', className }: ShareButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/share`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate share link');
      }

      const { shareUrl } = await res.json();
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied! Share it with friends');
    } catch (error) {
      console.error('Share failed:', error);
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
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
