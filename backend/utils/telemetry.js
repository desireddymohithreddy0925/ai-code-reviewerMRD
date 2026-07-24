import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, Memory, Event Loop Lag)
client.collectDefaultMetrics({ register });

// Define custom metrics
const llmTokenUsageTotal = new client.Counter({
  name: 'llm_token_usage_total',
  help: 'Total LLM tokens consumed',
  labelNames: ['type', 'repository'], // type: prompt or completion
});

const llmRequestLatencyMs = new client.Histogram({
  name: 'llm_request_latency_ms',
  help: 'Latency of LLM requests in milliseconds',
  labelNames: ['repository', 'model'],
  buckets: [100, 500, 1000, 2000, 5000, 10000, 30000], // Buckets in ms
});

const llmErrorRateTotal = new client.Counter({
  name: 'llm_error_rate_total',
  help: 'Total LLM API errors encountered',
  labelNames: ['status_code', 'repository'],
});

// Register metrics
register.registerMetric(llmTokenUsageTotal);
register.registerMetric(llmRequestLatencyMs);
register.registerMetric(llmErrorRateTotal);

export {
  register,
  llmTokenUsageTotal,
  llmRequestLatencyMs,
  llmErrorRateTotal
};
