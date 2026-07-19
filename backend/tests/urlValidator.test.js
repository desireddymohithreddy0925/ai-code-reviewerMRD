import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidRepoUrl, parseRepoUrl, isSafeUrl } from '../utils/urlValidator.js';

test('isValidRepoUrl should accept valid GitHub URLs', () => {
  assert.equal(isValidRepoUrl('https://github.com/owner/repo'), true);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo/'), true);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo.git'), true);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo-name'), true);
  assert.equal(isValidRepoUrl('https://github.com/owner-name/repo'), true);
  assert.equal(isValidRepoUrl('https://github.com/owner.name/repo.name'), true);
});

test('isValidRepoUrl should reject invalid URLs', () => {
  assert.equal(isValidRepoUrl(''), false);
  assert.equal(isValidRepoUrl(null), false);
  assert.equal(isValidRepoUrl(undefined), false);
  assert.equal(isValidRepoUrl('not-a-url'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner'), false);
  assert.equal(isValidRepoUrl('https://gitlab.com/owner/repo'), false);
  assert.equal(isValidRepoUrl('http://github.com/owner/repo'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo; echo injected'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo`id`'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo?query=1'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo#fragment'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo | cat /etc/passwd'), false);
  assert.equal(isValidRepoUrl('https://github.com/owner/repo && whoami'), false);
});

test('parseRepoUrl should extract owner and repo', () => {
  const result = parseRepoUrl('https://github.com/owner/repo');
  assert.notEqual(result, null);
  assert.equal(result.owner, 'owner');
  assert.equal(result.repo, 'repo');
});

test('parseRepoUrl should handle .git suffix', () => {
  const result = parseRepoUrl('https://github.com/owner/repo.git');
  assert.notEqual(result, null);
  assert.equal(result.owner, 'owner');
  assert.equal(result.repo, 'repo');
});

test('parseRepoUrl should return null for invalid URLs', () => {
  assert.equal(parseRepoUrl('invalid'), null);
  assert.equal(parseRepoUrl(''), null);
  assert.equal(parseRepoUrl('https://github.com/owner/repo; rm -rf /'), null);
});

test('parseRepoUrl should return null for null/undefined input', () => {
  assert.equal(parseRepoUrl(null), null);
  assert.equal(parseRepoUrl(undefined), null);
});

test('parseRepoUrl should handle trailing slashes correctly', () => {
  const result = parseRepoUrl('https://github.com/owner/repo/');
  assert.notEqual(result, null);
  assert.equal(result.owner, 'owner');
  assert.equal(result.repo, 'repo');
});

test('parseRepoUrl should handle .git/ trailing suffix', () => {
  const result = parseRepoUrl('https://github.com/owner/repo.git/');
  assert.notEqual(result, null);
  assert.equal(result.owner, 'owner');
  assert.equal(result.repo, 'repo');
});

test('parseRepoUrl returns null for URLs with multiple trailing slashes', () => {
  // isValidRepoUrl rejects URLs with multiple trailing slashes
  assert.equal(parseRepoUrl('https://github.com/owner/repo//'), null);
});

test('parseRepoUrl should return null for URLs with extra path segments', () => {
  assert.equal(parseRepoUrl('https://github.com/owner/repo/pull/1'), null);
  assert.equal(parseRepoUrl('https://github.com/owner/repo/tree/main/src'), null);
});

test('isSafeUrl validates basic URL safety', async () => {
  const localResult = await isSafeUrl('https://127.0.0.1/');
  assert.equal(localResult.valid, false);
  assert.ok(localResult.reason.includes('private or restricted IP'));

  const publicResult = await isSafeUrl('https://github.com/');
  assert.equal(publicResult.valid, true);
});

test('isSafeUrl rejects domains resolving to at least one private IP (DNS round-robin / multi-IP)', async (t) => {
  const dns = await import('node:dns');
  
  t.mock.method(dns.default, 'lookup', (hostname, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' ? options : {};
    if (opts.all) {
      cb(null, [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 }
      ]);
    } else {
      cb(null, '8.8.8.8', 4);
    }
  });

  const { isSafeUrl: freshIsSafeUrl } = await import(`../utils/urlValidator.js?test-mock=${Date.now()}`);
  const result = await freshIsSafeUrl('https://mixed-ip-domain.com');

  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('private or restricted IP'));
});
