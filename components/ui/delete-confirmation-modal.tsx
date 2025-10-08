'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  imageUrl?: string;
  imageName?: string;
  loading?: boolean;
  showDontAskAgain?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Image',
  description = 'Are you sure you want to delete this image? This action cannot be undone.',
  imageUrl,
  imageName,
  loading = false,
  showDontAskAgain = true,
}: DeleteConfirmationModalProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    if (dontAskAgain) {
      // Store preference in localStorage
      localStorage.setItem('skipDeleteConfirmation', 'true');
    }
    onConfirm();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            'bg-[#14171A] border border-[#2A2F37]  max-w-md w-full',
            'shadow-xl animate-scale-in'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 pb-0">
            <h2 className="text-xl font-semibold text-[#E6E8EB] mb-2">
              {title}
            </h2>
            <p className="text-[#B3B7BE] text-sm">
              {description}
            </p>
          </div>

          {/* Image Preview */}
          {imageUrl && (
            <div className="px-6 py-4">
              <div className="relative bg-[#1B1F24] overflow-hidden border border-[#2A2F37]">
                <Image
                  src={imageUrl}
                  alt={imageName || 'Image to delete'}
                  width={400}
                  height={128}
                  className="w-full h-32 object-contain"
                />
                {imageName && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-[#E6E8EB] text-xs truncate">
                      {imageName}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Don't ask again checkbox */}
          {showDontAskAgain && (
            <div className="px-6 pb-4">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    'w-4 h-4 rounded border-2 mr-3 transition-all duration-200',
                    'flex items-center justify-center',
                    dontAskAgain
                      ? 'bg-[#7C5CFF] border-[#7C5CFF]'
                      : 'border-[#2A2F37] group-hover:border-[#7C5CFF]/50'
                  )}
                >
                  {dontAskAgain && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24">
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-[#B3B7BE] text-sm select-none group-hover:text-[#E6E8EB] transition-colors">
                  Don&apos;t ask me again
                </span>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2  font-medium text-sm',
                'bg-[#1B1F24] text-[#E6E8EB] border border-[#2A2F37]',
                'hover:bg-[#2A2F37] hover:border-[#7C5CFF]/30',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2  font-medium text-sm',
                'bg-[#FF4D4D] text-white',
                'hover:bg-[#FF6B6B]',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Export a hook to manage delete confirmation state
export function useDeleteConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [targetAsset, setTargetAsset] = useState<{
    id: string;
    imageUrl?: string;
    imageName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const shouldSkipConfirmation = () => {
    return localStorage.getItem('skipDeleteConfirmation') === 'true';
  };

  const openConfirmation = (asset: {
    id: string;
    imageUrl?: string;
    imageName?: string;
  }) => {
    if (shouldSkipConfirmation()) {
      // Return true to indicate immediate confirmation
      return true;
    }
    setTargetAsset(asset);
    setIsOpen(true);
    return false;
  };

  const closeConfirmation = () => {
    setIsOpen(false);
    setTargetAsset(null);
    setLoading(false);
  };

  const resetPreference = () => {
    localStorage.removeItem('skipDeleteConfirmation');
  };

  return {
    isOpen,
    targetAsset,
    loading,
    setLoading,
    openConfirmation,
    closeConfirmation,
    resetPreference,
    shouldSkipConfirmation,
  };
}