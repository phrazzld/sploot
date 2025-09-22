'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Start exit animation
    const exitTimer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 300); // Match animation duration
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [duration, onClose]);

  const icons = {
    success: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const colors = {
    success: 'text-[#B6FF6E] bg-[#B6FF6E]/10',
    error: 'text-[#FF4D4D] bg-[#FF4D4D]/10',
    info: 'text-[#7C5CFF] bg-[#7C5CFF]/10',
  };

  return (
    <div
      className={cn(
        'fixed bottom-8 left-1/2 z-50 flex items-center gap-3 rounded-full border px-4 py-3 shadow-2xl transition-all duration-300 ease-out',
        'border-[#2A2F37] bg-[#14171A] backdrop-blur-md',
        isVisible && !isLeaving
          ? '-translate-x-1/2 translate-y-0 opacity-100 scale-100'
          : '-translate-x-1/2 translate-y-4 opacity-0 scale-95'
      )}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', colors[type])}>
        {icons[type]}
      </div>
      <p className="text-sm font-medium text-[#E6E8EB]">{message}</p>
    </div>
  );
}

// Toast container to manage multiple toasts
interface ToastData {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

let toastQueue: ToastData[] = [];
let addToastFunction: ((toast: ToastData) => void) | null = null;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    // Register the add function
    addToastFunction = (toast: ToastData) => {
      setToasts((prev) => [...prev, toast]);
    };

    // Process any queued toasts
    if (toastQueue.length > 0) {
      toastQueue.forEach((toast) => addToastFunction?.(toast));
      toastQueue = [];
    }

    return () => {
      addToastFunction = null;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Only show the first toast (queue others)
  const currentToast = toasts[0];

  if (!currentToast) return null;

  return (
    <Toast
      key={currentToast.id}
      message={currentToast.message}
      type={currentToast.type}
      duration={currentToast.duration}
      onClose={() => removeToast(currentToast.id)}
    />
  );
}

// Global function to show toast
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000) {
  const toast: ToastData = {
    id: `${Date.now()}-${Math.random()}`,
    message,
    type,
    duration,
  };

  if (addToastFunction) {
    addToastFunction(toast);
  } else {
    // Queue if container not mounted yet
    toastQueue.push(toast);
  }
}