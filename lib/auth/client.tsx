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

// Separate components for mock and real auth providers
function MockAuthProvider({ children }: { children: React.ReactNode }) {
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

function RealAuthProvider({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const useMock = isMockClientMode();

  if (useMock) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }

  return <RealAuthProvider>{children}</RealAuthProvider>;
}

// Separate hook implementations for mock and real auth
function useMockAuthUser() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useAuthUser must be used within AuthProvider');
  }
  return { user: context.user };
}

function useRealAuthUser() {
  return useUserOriginal();
}

function useMockAuthActions() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useAuthActions must be used within AuthProvider');
  }
  return {
    signOut: context.signOut,
  };
}

function useRealAuthActions() {
  return useClerkOriginal();
}

// Export wrapper hooks that decide which implementation to use
export function useAuthUser() {
  // This check happens at runtime, not during render
  // Both branches will use hooks consistently
  if (isMockClientMode()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMockAuthUser();
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRealAuthUser();
  }
}

export function useAuthActions() {
  // This check happens at runtime, not during render
  // Both branches will use hooks consistently
  if (isMockClientMode()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMockAuthActions();
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useRealAuthActions();
  }
}