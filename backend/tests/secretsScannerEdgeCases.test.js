import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSecrets, scanSecretsInChanges } from '../utils/secretsScanner.js';

test('scanSecrets returns empty array for invalid inputs', () => {
  assert.deepEqual(scanSecrets(null), []);
  assert.deepEqual(scanSecrets(undefined), []);
  assert.deepEqual(scanSecrets(12345), []);
  assert.deepEqual(scanSecrets({}), []);
});

test('scanSecretsInChanges returns empty results for invalid inputs', () => {
  const expected = { findings: [], truncated: false, totalChanges: 0, skippedReason: null };
  assert.deepEqual(scanSecretsInChanges(null), expected);
  assert.deepEqual(scanSecretsInChanges(undefined), expected);
  assert.deepEqual(scanSecretsInChanges("invalid_string"), expected);
  assert.deepEqual(scanSecretsInChanges({}), expected);
});

test('scanSecretsInChanges handles invalid change objects gracefully', () => {
  const changes = [
    null,
    { line: 5 },
    { line: 10, content: null },
    { line: 12, content: 'clean content' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.deepEqual(results.findings, []);
});
