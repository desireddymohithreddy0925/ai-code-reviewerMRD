import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSecretsInChanges } from '../utils/secretsScanner.js';

test('scanSecretsInChanges detects GitHub Personal Access Token', () => {
  const changes = [
    { line: 1, content: 'const pat = "ghp_abc123xyz456789012345678901234567890"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 1);
  assert.equal(results.findings[0].type, 'security');
  assert.ok(results.findings[0].comment.includes('GitHub Personal Access Token'));
});

test('scanSecretsInChanges detects AWS Access Key', () => {
  const changes = [
    { line: 5, content: 'aws_key = "AKIA1234567890ABCDEF"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 1);
  assert.ok(results.findings[0].comment.includes('AWS Access Key'));
});

test('scanSecretsInChanges detects Common Environment Credential', () => {
  const changes = [
    { line: 3, content: 'const DB_PASSWORD = "super_secret_pass_123456"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.ok(results.findings.length >= 1, 'should detect at least one secret');
});

test('scanSecretsInChanges detects Google Cloud API Key', () => {
  const gcpKey = 'AIzaSy' + 'A1b2c3D4e5F6g7H8i9J0k1L2m3N4o5P6qA';
  const changes = [
    { line: 7, content: `gcp_key = "${gcpKey}"` }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 1);
  assert.ok(results.findings[0].comment.includes('Google Cloud'));
});

test('scanSecretsInChanges detects JWT Token', () => {
  const changes = [
    { line: 10, content: '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SignaturePart"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.ok(results.findings.length >= 1, 'should detect at least one secret including JWT');
  const jwtResult = results.findings.find(r => r.comment.includes('JWT'));
  assert.ok(jwtResult, 'JWT should be detected');
});

test('scanSecretsInChanges detects Generic API Key', () => {
  const changes = [
    { line: 2, content: 'api_key: "abcdefgh1234567890"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 1);
  assert.ok(results.findings[0].comment.includes('Generic API Key'));
});

test('scanSecretsInChanges detects Private Key', () => {
  const changes = [
    { line: 1, content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 1);
  assert.ok(results.findings[0].comment.includes('Private Key'));
});

test('scanSecretsInChanges detects multiple secrets in same change', () => {
  const changes = [
    { line: 1, content: 'const aws = "AKIA1234567890ABCDEF"; const pat = "ghp_abc123xyz456789012345678901234567890"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 2);
  const lines = results.findings.map(r => r.line);
  assert.deepEqual(lines, [1, 1]);
});

test('scanSecretsInChanges returns empty for clean changes', () => {
  const changes = [
    { line: 1, content: 'const x = 1;' },
    { line: 2, content: 'function foo() { return 42; }' },
    { line: 3, content: 'export default App;' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 0);
});

test('scanSecretsInChanges returns at least one finding for any secret pattern', () => {
  const changes = [
    { line: 77, content: 'const db = "mongodb://user:pass123@host:27017/db"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.ok(results.findings.length >= 1, 'should detect database credential');
});

test('scanSecretsInChanges handles missing content key gracefully', () => {
  const changes = [
    { content: 'some content without line key' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings.length, 0);
});

test('scanSecretsInChanges result type is always security', () => {
  const changes = [
    { line: 1, content: 'github_pat = "ghp_abc123xyz456789012345678901234567890"' }
  ];
  const results = scanSecretsInChanges(changes);
  assert.equal(results.findings[0].type, 'security');
});
