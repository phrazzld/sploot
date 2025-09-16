'use client';

import { ClerkProvider, useClerk as useClerkOriginal, useUser as useUserOriginal } from '@clerk/nextjs';
import React, { createContext, useContext, useMemo } from 'react';
import { isMockClientMode } from '../env.client';

interface MockUser {
  id: string;
  firstName: string;
  username: string;
  emailAddresses: Array<{ emailAddress: string }>;
}

interface MockAuthContextValue {
  user: MockUser;
  signOut: () => Promise<void>;
}

const MockAuthContext = createContext<MockAuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const useMock = isMockClientMode();

  if (!useMock) {
    return <ClerkProvider>{children}</ClerkProvider>;
  }

  const value = useMemo<MockAuthContextValue>(() => ({
    user: {
      id: 'mock-user-id',
      firstName: 'Mock',
      username: 'mock-user',
      emailAddresses: [{ emailAddress: 'mock@sploot.dev' }],
    },
    async signOut() {
      // no-op for mock mode
      return Promise.resolve();
    },
  }), []);

  return (
    <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>
  );
}

export function useAuthUser() {
  if (!isMockClientMode()) {
    return useUserOriginal();
  }

  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useAuthUser must be used within AuthProvider');
  }

  return { user: context.user };
}

export function useAuthActions() {
  if (!isMockClientMode()) {
    return useClerkOriginal();
  }

  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useAuthActions must be used within AuthProvider');
  }

  return {
    signOut: context.signOut,
  };
}
