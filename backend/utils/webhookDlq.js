import { redisClient } from '../index.js';

const DLQ_KEY = 'webhook:dlq';

export class WebhookDlq {
  /**
   * Pushes a throttled or failed webhook request onto the Dead Letter Queue.
   */
  static async push(req) {
    if (!redisClient) return;

    try {
      const dlqItem = {
        headers: req.headers,
        rawBody: req.rawBody,
        timestamp: Date.now(),
        retryCount: 0
      };

      await redisClient.lpush(DLQ_KEY, JSON.stringify(dlqItem));
      console.log(`📥 Webhook pushed to DLQ (Queue Size: ${await redisClient.llen(DLQ_KEY)})`);
    } catch (err) {
      console.error(`❌ Failed to push webhook to DLQ: ${err.message}`);
    }
  }

  /**
   * Starts a background worker to periodically drain the DLQ and process items.
   */
  static startWorker(processWebhookFn) {
    if (!redisClient) return;

    console.log('🔄 Started Webhook DLQ Worker.');

    // Run every 2 minutes
    setInterval(async () => {
      try {
        const queueSize = await redisClient.llen(DLQ_KEY);
        if (queueSize === 0) return;

        console.log(`⚙️ DLQ Worker draining ${queueSize} webhooks...`);

        // Pop an item from the right side of the list (oldest first)
        const itemStr = await redisClient.rpop(DLQ_KEY);
        if (itemStr) {
          const item = JSON.parse(itemStr);
          
          // Reconstruct a mock request object for the processing function
          const mockReq = {
            headers: item.headers,
            rawBody: item.rawBody,
            body: item.rawBody ? JSON.parse(item.rawBody) : {},
            // Mark it as a DLQ retry to prevent infinite loops if needed
            isDlqRetry: true 
          };

          // Reconstruct a mock response object
          const mockRes = {
            status: () => mockRes,
            json: () => mockRes,
            send: () => mockRes
          };

          console.log('♻️ Re-processing DLQ Webhook...');
          
          // Pass it back to the main webhook handler logic
          await processWebhookFn(mockReq, mockRes);
        }
      } catch (err) {
        console.error(`❌ DLQ Worker Error: ${err.message}`);
      }
    }, 120000).unref();
  }
}
