import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubRepositoryPayload } from '../utils/secretScrubber.js';

test('scrubRepositoryPayload scrubs AWS Access Key ID and PATs', () => {
  const payload = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE\nPAT=ghp_1234567890abcdefghijklmnopqrstuvwxyz';
  const sanitized = scrubRepositoryPayload(payload);
  assert.ok(!sanitized.includes('AKIAIOSFODNN7EXAMPLE'));
  assert.ok(!sanitized.includes('ghp_1234567890abcdefghijklmnopqrstuvwxyz'));
  assert.ok(sanitized.includes('[REDACTED_SECRET]'));
});

test('scrubRepositoryPayload preserves valid 40-character Git commit SHAs', () => {
  const sha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4';
  const payload = `commit ${sha}\nAuthor: developer`;
  const sanitized = scrubRepositoryPayload(payload);
  assert.equal(sanitized.includes(sha), true);
});
