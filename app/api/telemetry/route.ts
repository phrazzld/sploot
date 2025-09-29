import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth/server';

interface TelemetryPayload {
  assetId: string;
  blobUrl: string;
  errorType: string;
  timestamp: number;
}

/**
 * POST /api/telemetry
 * Log telemetry events (blob errors, performance metrics, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: TelemetryPayload = await request.json();

    // Validate payload
    if (!payload.assetId || !payload.blobUrl || !payload.errorType || !payload.timestamp) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Log to console (can be extended to external services like Sentry, Datadog, etc.)
    console.error('[Telemetry] Blob error:', {
      userId,
      assetId: payload.assetId,
      blobUrl: payload.blobUrl,
      errorType: payload.errorType,
      timestamp: new Date(payload.timestamp).toISOString(),
    });

    // TODO: Send to external monitoring service
    // await sendToMonitoringService(payload);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Telemetry] Failed to log telemetry:', error);
    // Don't fail the request - telemetry should be non-blocking
    return NextResponse.json({ success: false }, { status: 200 });
  }
}