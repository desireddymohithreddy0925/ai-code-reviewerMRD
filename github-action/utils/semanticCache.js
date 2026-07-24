import Redis from 'ioredis';
import crypto from 'node:crypto';

export class SemanticCache {
  constructor(redisUrl) {
    this.enabled = Boolean(redisUrl);
    if (this.enabled) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => null, // Do not endlessly retry if Redis is down
        });
        this.redis.on('error', (err) => {
          console.warn(`⚠️ Redis cache error: ${err.message}`);
          this.enabled = false;
        });
      } catch (err) {
        console.warn(`⚠️ Failed to initialize Redis cache: ${err.message}`);
        this.enabled = false;
      }
    }
  }

  /**
   * Generates a deterministic SHA-256 hash of the diff and prompt context
   */
  generateHash(diffText, promptContext) {
    const payload = JSON.stringify({ diffText, promptContext });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Retrieves cached AI response if it exists
   */
  async get(hash) {
    if (!this.enabled || !this.redis) return null;
    try {
      const cached = await this.redis.get(`reposage:cache:${hash}`);
      if (cached) {
        return cached; // Return raw JSON string
      }
    } catch (err) {
      console.warn(`⚠️ Redis GET failed: ${err.message}`);
    }
    return null;
  }

  /**
   * Stores AI response in the cache with a 7-day TTL
   */
  async set(hash, responseContent) {
    if (!this.enabled || !this.redis) return;
    try {
      // 7 days = 604800 seconds
      await this.redis.setex(`reposage:cache:${hash}`, 604800, responseContent);
    } catch (err) {
      console.warn(`⚠️ Redis SET failed: ${err.message}`);
    }
  }
  
  /**
   * Safely closes the Redis connection so the GitHub action can exit
   */
  async quit() {
    if (this.enabled && this.redis) {
      try {
        await this.redis.quit();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }
}
