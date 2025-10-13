import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated This endpoint is deprecated due to security vulnerability (exposed master token).
 * Use POST /api/upload/handle instead, which uses scoped, time-limited tokens.
 *
 * Security issue: This endpoint returned the master BLOB_READ_WRITE_TOKEN to clients,
 * granting full read/write/delete access to the entire blob storage.
 *
 * Migration: Update client code to use the upload() SDK with handleUploadUrl: '/api/upload/handle'
 */
export async function GET(req: NextRequest) {
  // Return 410 Gone - endpoint deprecated for security reasons
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated due to security vulnerability',
      reason: 'Exposed master blob storage token to clients',
      migration: 'Use POST /api/upload/handle with @vercel/blob upload() SDK',
      documentation: 'https://vercel.com/docs/storage/vercel-blob/using-blob-sdk#generate-client-upload-urls',
    },
    {
      status: 410,
      headers: {
        'X-Deprecated': 'true',
        'X-Deprecated-Replacement': '/api/upload/handle',
      },
    }
  );
}
