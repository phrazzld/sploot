/**
 * Server-Sent Events (SSE) endpoint for real-time processing queue updates
 *
 * Streams processing statistics every 5 seconds to connected clients.
 * Clients use this to monitor progress through the upload → process → embed pipeline.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Connection configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const UPDATE_INTERVAL = 5000; // 5 seconds - poll processing-stats
const MAX_CONNECTION_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_TIME = 5000; // 5 seconds retry for client

export const runtime = 'nodejs'; // Use Node.js runtime for SSE
export const dynamic = 'force-dynamic'; // Disable caching

/**
 * SSE endpoint for processing queue updates
 * GET /api/sse/processing-updates
 *
 * Streams events every 5 seconds with current queue statistics:
 * {
 *   type: 'progress',
 *   stats: { total, uploaded, processing, embedding, ready, failed },
 *   timestamp: number
 * }
 */
export async function GET(request: NextRequest) {
  // Authenticate user
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = Date.now();
  console.log(`[SSE] Processing updates connection established for user ${userId}`);

  // Create SSE stream
  const encoder = new TextEncoder();
  const customReadable = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({
          type: 'connected',
          timestamp: Date.now()
        })}\nretry: ${MAX_RETRY_TIME}\n\n`)
      );

      // Set up heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`:heartbeat ${Date.now()}\n\n`)
          );
        } catch (error) {
          // Connection closed, clean up
          clearInterval(heartbeatInterval);
        }
      }, HEARTBEAT_INTERVAL);

      // Function to fetch and send processing stats
      const sendProcessingStats = async () => {
        try {
          // Fetch stats from our cached endpoint
          // Prefer NEXT_PUBLIC_APP_URL (custom domain) → VERCEL_URL (default) → localhost
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

          const response = await fetch(`${baseUrl}/api/processing-stats`, {
            headers: {
              'Cookie': request.headers.get('cookie') || '',
            },
          });

          if (!response.ok) {
            throw new Error(`Stats fetch failed: ${response.status}`);
          }

          const data = await response.json();

          // Send progress update event
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${JSON.stringify({
              type: 'progress',
              stats: data.stats,
              cached: data.cached,
              timestamp: Date.now(),
            })}\n\n`)
          );
        } catch (error) {
          console.error('[SSE] Error fetching processing stats:', error);
          // Don't close connection on fetch errors - stats endpoint might be temporarily unavailable
        }
      };

      // Send initial stats immediately
      await sendProcessingStats();

      // Set up polling for stats updates
      const pollInterval = setInterval(async () => {
        // Check if connection has been open too long (5 minutes)
        if (Date.now() - startTime > MAX_CONNECTION_TIME) {
          console.log(`[SSE] Connection timeout for user ${userId} (5 minutes)`);
          clearInterval(heartbeatInterval);
          clearInterval(pollInterval);
          controller.close();
          return;
        }

        await sendProcessingStats();
      }, UPDATE_INTERVAL);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        const duration = Date.now() - startTime;
        console.log(`[SSE] Processing updates connection closed for user ${userId} (duration: ${duration}ms)`);
        clearInterval(heartbeatInterval);
        clearInterval(pollInterval);
      });
    },
  });

  // Return SSE response with proper headers
  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  });
}
