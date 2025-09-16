export function isMockClientMode(): boolean {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES) {
    return process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES === 'true';
  }
  if (typeof window !== 'undefined') {
    const flag = (window as any).__NEXT_PUBLIC_ENABLE_MOCK_SERVICES__;
    if (typeof flag === 'boolean') {
      return flag;
    }
  }
  return false;
}
