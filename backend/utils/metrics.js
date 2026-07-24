import promClient from 'prom-client';

// Create a Registry
export const register = new promClient.Registry();

// Enable default metrics (Node.js CPU/Memory)
promClient.collectDefaultMetrics({ register });

export const llmTokenUsageCounter = new promClient.Counter({
  name: 'llm_token_usage_total',
  help: 'Total number of tokens consumed by the LLM',
  labelNames: ['repo', 'type'] // type = 'prompt' | 'completion'
});
register.registerMetric(llmTokenUsageCounter);

export const llmRequestDurationHistogram = new promClient.Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Latency of LLM API requests in seconds',
  labelNames: ['repo'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60]
});
register.registerMetric(llmRequestDurationHistogram);

export const llmErrorsCounter = new promClient.Counter({
  name: 'llm_errors_total',
  help: 'Total number of LLM API errors',
  labelNames: ['repo', 'status_code']
});
register.registerMetric(llmErrorsCounter);
