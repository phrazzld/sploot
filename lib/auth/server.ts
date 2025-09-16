import { isMockMode } from '../env';

interface AuthResult {
  userId: string | null;
  sessionId: string | null;
  getToken: (options?: unknown) => Promise<string | null>;
}

const MOCK_AUTH_RESULT: AuthResult = {
  userId: 'mock-user-id',
  sessionId: 'mock-session-id',
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

export async function requireUserId(): Promise<string> {
  const { userId } = await getAuth();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
