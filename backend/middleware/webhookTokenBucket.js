import { redisClient } from '../index.js'; // Assuming redisClient is exported from index.js or passed in
import { WebhookDlq } from '../utils/webhookDlq.js';

// Lua script for a Token Bucket algorithm
const tokenBucketScript = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refillRate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  
  local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
  local tokens = tonumber(bucket[1])
  local lastRefill = tonumber(bucket[2])
  
  if not tokens then
    tokens = capacity
    lastRefill = now
  else
    local elapsedTime = math.max(0, now - lastRefill)
    local refillTokens = math.floor(elapsedTime * refillRate)
    tokens = math.min(capacity, tokens + refillTokens)
    if refillTokens > 0 then
      lastRefill = now
    end
  end
  
  if tokens > 0 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
    -- Expire key after bucket completely refills
    local timeToRefill = math.ceil(capacity / refillRate)
    redis.call('EXPIRE', key, timeToRefill)
    return {1, tokens}
  else
    return {0, tokens}
  end
`;

export function createTokenBucketLimiter(options) {
  const { capacity = 10, refillRate = 1 / 60, dlqEnabled = true } = options; // 1 token per 60 seconds (1 minute)

  return async (req, res, next) => {
    if (!redisClient) {
      // Fallback if Redis is unavailable
      return next();
    }

    try {
      let repoId = 'global';
      let senderId = 'global';

      if (req.rawBody) {
        try {
          const payload = JSON.parse(req.rawBody);
          if (payload.repository?.id) repoId = payload.repository.id;
          if (payload.sender?.id) senderId = payload.sender.id;
        } catch (e) {
          // ignore parsing error
        }
      }

      // Generate a dynamic key based on repo and sender
      const bucketKey = `rate:webhook:${repoId}:${senderId}`;
      const now = Math.floor(Date.now() / 1000); // Current time in seconds

      const result = await redisClient.eval(
        tokenBucketScript,
        1,
        bucketKey,
        capacity,
        refillRate,
        now
      );

      const [allowed, remainingTokens] = result;

      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', remainingTokens);

      if (allowed === 1) {
        return next();
      } else {
        const retryAfterSeconds = Math.ceil(1 / refillRate);
        res.setHeader('Retry-After', retryAfterSeconds);
        
        if (dlqEnabled) {
          await WebhookDlq.push(req);
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Webhook rate limit exceeded. Your request has been queued or dropped.'
        });
      }
    } catch (err) {
      console.warn(`⚠️ Token Bucket Error: ${err.message}`);
      return next(); // Fail open on Redis errors
    }
  };
}
