/**
 * PostgreSQL LISTEN/NOTIFY Listener
 *
 * Listens for database notifications from PostgreSQL triggers
 * and broadcasts them to connected clients via SSE.
 *
 * Note: This requires a persistent connection and is best suited
 * for deployment on platforms that support long-running processes.
 * For serverless deployments, consider using polling or external message queues.
 */

import { Client } from 'pg';
import { broadcastEmbeddingUpdate } from '@/lib/sse-broadcaster';
import { prisma } from '@/lib/db';

export interface PgNotification {
  channel: string;
  payload: {
    assetId: string;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    error?: string;
    modelName?: string;
    modelVersion?: string;
    timestamp: number;
  };
}

/**
 * PostgreSQL NOTIFY listener
 */
export class PgNotifyListener {
  private client: Client | null = null;
  private isListening = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  // Configuration
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private readonly channels = [
    'embedding_complete',
    'embedding_processing',
    'embedding_failed'
  ];

  constructor(private connectionString?: string) {
    this.connectionString = connectionString || process.env.POSTGRES_URL_NON_POOLING;
  }

  /**
   * Start listening for notifications
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.log('[PgNotifyListener] Already listening');
      return;
    }

    try {
      await this.connect();
      await this.listen();
      this.isListening = true;
      console.log('[PgNotifyListener] Started successfully');
    } catch (error) {
      console.error('[PgNotifyListener] Failed to start:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Stop listening for notifications
   */
  async stop(): Promise<void> {
    this.isListening = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.unlisten();
        await this.client.end();
      } catch (error) {
        console.error('[PgNotifyListener] Error during shutdown:', error);
      }
      this.client = null;
    }

    console.log('[PgNotifyListener] Stopped');
  }

  /**
   * Connect to PostgreSQL
   */
  private async connect(): Promise<void> {
    if (!this.connectionString) {
      throw new Error('PostgreSQL connection string not provided');
    }

    this.client = new Client({
      connectionString: this.connectionString,
      // Prevent timeout on idle connection
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Set up event handlers
    this.client.on('notification', this.handleNotification.bind(this));
    this.client.on('error', this.handleError.bind(this));
    this.client.on('end', this.handleDisconnect.bind(this));

    await this.client.connect();
    console.log('[PgNotifyListener] Connected to PostgreSQL');
  }

  /**
   * Start listening to channels
   */
  private async listen(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }

    for (const channel of this.channels) {
      await this.client.query(`LISTEN ${channel}`);
      console.log(`[PgNotifyListener] Listening to channel: ${channel}`);
    }
  }

  /**
   * Stop listening to channels
   */
  private async unlisten(): Promise<void> {
    if (!this.client) return;

    for (const channel of this.channels) {
      try {
        await this.client.query(`UNLISTEN ${channel}`);
      } catch (error) {
        console.error(`[PgNotifyListener] Error unlistening from ${channel}:`, error);
      }
    }
  }

  /**
   * Handle incoming notifications
   */
  private async handleNotification(msg: any): Promise<void> {
    console.log(`[PgNotifyListener] Received notification on ${msg.channel}:`, msg.payload);

    try {
      const notification: PgNotification = {
        channel: msg.channel,
        payload: JSON.parse(msg.payload)
      };

      // Process based on channel
      switch (notification.channel) {
        case 'embedding_complete':
        case 'embedding_processing':
        case 'embedding_failed':
          await this.handleEmbeddingNotification(notification);
          break;
        default:
          console.warn(`[PgNotifyListener] Unknown channel: ${notification.channel}`);
      }
    } catch (error) {
      console.error('[PgNotifyListener] Error handling notification:', error);
    }
  }

  /**
   * Handle embedding-related notifications
   */
  private async handleEmbeddingNotification(notification: PgNotification): Promise<void> {
    const { assetId, status, error, modelName, modelVersion } = notification.payload;

    try {
      // Get the asset owner to broadcast to the correct user
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { ownerUserId: true }
      });

      if (!asset) {
        console.warn(`[PgNotifyListener] Asset not found: ${assetId}`);
        return;
      }

      // Broadcast to connected SSE clients
      await broadcastEmbeddingUpdate(
        asset.ownerUserId,
        assetId,
        {
          status,
          error,
          modelName,
          hasEmbedding: status === 'ready'
        }
      );

      console.log(`[PgNotifyListener] Broadcasted ${status} update for asset ${assetId}`);
    } catch (error) {
      console.error('[PgNotifyListener] Error broadcasting update:', error);
    }
  }

  /**
   * Handle connection errors
   */
  private handleError(error: Error): void {
    console.error('[PgNotifyListener] Connection error:', error);

    if (this.isListening) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    console.log('[PgNotifyListener] Disconnected from PostgreSQL');

    if (this.isListening) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[PgNotifyListener] Max reconnection attempts reached. Giving up.');
      this.isListening = false;
      return;
    }

    this.reconnectAttempts++;
    console.log(`[PgNotifyListener] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${this.RECONNECT_DELAY}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.start();
        this.reconnectAttempts = 0; // Reset on successful reconnection
      } catch (error) {
        console.error('[PgNotifyListener] Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, this.RECONNECT_DELAY);
  }
}

// Singleton instance
let listenerInstance: PgNotifyListener | null = null;

/**
 * Get or create the PgNotifyListener instance
 */
export function getPgNotifyListener(): PgNotifyListener {
  if (!listenerInstance) {
    listenerInstance = new PgNotifyListener();
  }
  return listenerInstance;
}

/**
 * Initialize the listener (to be called from a long-running process)
 * Note: This won't work in serverless functions as they don't maintain
 * persistent connections. Consider using this in a separate worker process
 * or a platform that supports background jobs.
 */
export async function initializePgListener(): Promise<void> {
  const listener = getPgNotifyListener();
  await listener.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[PgNotifyListener] Received SIGINT, shutting down...');
    await listener.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[PgNotifyListener] Received SIGTERM, shutting down...');
    await listener.stop();
    process.exit(0);
  });
}