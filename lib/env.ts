const PLACEHOLDER_MARKERS = [
  'your_actual_key',
  'your_actual_secret',
  'your_blob_token',
  'your_postgres_url',
  'your_postgres_url_non_pooling',
  'your_replicate_token',
  'your_replicate_token_here',
];

function isValueMissing(value: string | undefined | null) {
  if (!value) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some(marker => lower.includes(marker));
}

const hasClerkConfig = !isValueMissing(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  !isValueMissing(process.env.CLERK_SECRET_KEY);
const hasBlobConfig = !isValueMissing(process.env.BLOB_READ_WRITE_TOKEN);
const hasDatabaseConfig = !isValueMissing(process.env.POSTGRES_URL) &&
  !isValueMissing(process.env.POSTGRES_URL_NON_POOLING);
const hasReplicateConfig = !isValueMissing(process.env.REPLICATE_API_TOKEN);

const defaultMockEnabled = !hasClerkConfig || !hasBlobConfig || !hasDatabaseConfig || !hasReplicateConfig;

const explicitSetting = (process.env.ENABLE_MOCK_SERVICES || process.env.MOCK_SERVICES || '').toLowerCase();

export const mockServicesEnabled = explicitSetting === 'true'
  ? true
  : explicitSetting === 'false'
    ? false
    : defaultMockEnabled;

export const databaseConfigured = hasDatabaseConfig;
export const blobConfigured = hasBlobConfig;
export const clerkConfigured = hasClerkConfig;
export const replicateConfigured = hasReplicateConfig;

export function isMockMode() {
  return mockServicesEnabled;
}

export function ensurePublicMockEnv() {
  if (typeof process !== 'undefined') {
    const flag = mockServicesEnabled ? 'true' : 'false';
    if (!process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES) {
      process.env.NEXT_PUBLIC_ENABLE_MOCK_SERVICES = flag;
    }
  }
}

ensurePublicMockEnv();
