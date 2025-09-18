import { isMockMode } from '../env';
import { getOrCreateUser } from '../db';

interface AuthResult {
  userId: string | null;
  sessionId: string | null;
  getToken: (options?: unknown) => Promise<string | null>;
}

interface AuthWithUserResult extends AuthResult {
  userEmail?: string;
}

const MOCK_AUTH_RESULT: AuthWithUserResult = {
  userId: 'mock-user-id',
  sessionId: 'mock-session-id',
  userEmail: 'mock@sploot.dev',
  async getToken() {
    return null;
  },
};

export async function getAuth(): Promise<AuthResult> {
  if (isMockMode()) {
    return MOCK_AUTH_RESULT;
  }

  try {
    const clerk = await import('@clerk/nextjs/server');
    return clerk.auth();
  } catch (error) {
    if (isMockMode()) {
      return MOCK_AUTH_RESULT;
    }
    throw error;
  }
}

/**
 * Get authenticated user and ensure they exist in the database
 * This automatically syncs Clerk users with our database
 */
export async function getAuthWithUser(): Promise<AuthWithUserResult> {
  if (isMockMode()) {
    return MOCK_AUTH_RESULT;
  }

  try {
    const clerk = await import('@clerk/nextjs/server');
    const authResult = await clerk.auth();

    if (!authResult.userId) {
      return authResult;
    }

    // Get the full user details from Clerk
    const user = await clerk.currentUser();
    if (user) {
      const email = user.emailAddresses[0]?.emailAddress || `${authResult.userId}@clerk.local`;

      // Ensure user exists in database
      await getOrCreateUser(authResult.userId, email);

      return {
        ...authResult,
        userEmail: email,
      };
    }

    return authResult;
  } catch (error) {
    if (isMockMode()) {
      return MOCK_AUTH_RESULT;
    }
    throw error;
  }
}

export async function requireUserId(): Promise<string> {
  const { userId } = await getAuth();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

/**
 * Require authenticated user and ensure they exist in database
 * Use this for any endpoint that writes to the database
 */
export async function requireUserIdWithSync(): Promise<string> {
  const { userId } = await getAuthWithUser();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
