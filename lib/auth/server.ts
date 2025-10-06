import { getOrCreateUser } from '../db';

interface AuthResult {
  userId: string | null;
  sessionId: string | null;
  getToken: (options?: any) => Promise<string | null>;
}

interface AuthWithUserResult extends AuthResult {
  userEmail?: string;
}

export async function getAuth(): Promise<AuthResult> {
  const clerk = await import('@clerk/nextjs/server');
  const auth = await clerk.auth();
  return {
    userId: auth.userId,
    sessionId: auth.sessionId,
    getToken: auth.getToken as any,
  };
}

/**
 * Get authenticated user and ensure they exist in the database
 * This automatically syncs Clerk users with our database
 */
export async function getAuthWithUser(): Promise<AuthWithUserResult> {
  const clerk = await import('@clerk/nextjs/server');
  const authResult = await clerk.auth();

  if (!authResult.userId) {
    return {
      userId: authResult.userId,
      sessionId: authResult.sessionId,
      getToken: authResult.getToken as any,
    };
  }

  // Get the full user details from Clerk
  const user = await clerk.currentUser();
  if (user) {
    const email = user.emailAddresses[0]?.emailAddress || `${authResult.userId}@clerk.local`;

    // Ensure user exists in database
    await getOrCreateUser(authResult.userId, email);

    return {
      userId: authResult.userId,
      sessionId: authResult.sessionId,
      getToken: authResult.getToken as any,
      userEmail: email,
    };
  }

  return {
    userId: authResult.userId,
    sessionId: authResult.sessionId,
    getToken: authResult.getToken as any,
  };
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
