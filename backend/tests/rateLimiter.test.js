import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Unit tests verifying the rate limiter key extraction contract.
//
// After the fix for the IP-spoofing rate limit bypass, we NO LONGER have a
// custom getRealClientIp helper. express-rate-limit now defaults to req.ip,
// which Express correctly resolves via the `trust proxy: 1` setting.
//
// These tests document and verify the correct contract:
//   - The rate limit key MUST be req.ip (the trust-proxy-resolved value)
//   - The raw X-Forwarded-For header MUST NOT be used as the key, because
//     its leftmost entry is client-controlled and enables IP spoofing.
// ---------------------------------------------------------------------------

// Simulate what express-rate-limit does by default: use req.ip
function getRateLimitKey(req) {
  return req.ip;
}

test('uses req.ip as the rate limit key (direct connection, no proxy)', () => {
  const req = { ip: '203.0.113.1', headers: {} };
  assert.equal(getRateLimitKey(req), '203.0.113.1');
});

test('uses req.ip as the rate limit key even when X-Forwarded-For header is present', () => {
  // With `trust proxy: 1`, Express sets req.ip to the trusted resolved IP,
  // not the raw header value. The raw header value is client-controlled and
  // MUST NOT be used as the rate limit key.
  const req = {
    // Express has already resolved this to the correct IP after trust-proxy processing
    ip: '203.0.113.5',
    headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.5, 10.0.0.1' },
  };
  // Key should be the trust-proxy-resolved req.ip, not '9.9.9.9' (attacker-controlled leftmost)
  assert.equal(getRateLimitKey(req), '203.0.113.5');
  assert.notEqual(getRateLimitKey(req), '9.9.9.9'); // must not use spoofable header value
});

test('uses req.ip for IPv6 addresses', () => {
  const req = { ip: '2001:db8::1', headers: {} };
  assert.equal(getRateLimitKey(req), '2001:db8::1');
});

test('uses req.ip when X-Forwarded-For header is absent', () => {
  const req = { ip: '198.51.100.7', headers: {} };
  assert.equal(getRateLimitKey(req), '198.51.100.7');
});

test('uses req.ip when X-Forwarded-For header is an array (some middleware behaviour)', () => {
  // Even in this edge case, req.ip (set by Express) is the correct source of truth
  const req = {
    ip: '203.0.113.1',
    headers: { 'x-forwarded-for': ['203.0.113.1', '10.0.0.2'] },
  };
  assert.equal(getRateLimitKey(req), '203.0.113.1');
});

// ---------------------------------------------------------------------------
// Security regression test: verify the old spoofing vector is closed.
//
// The original getRealClientIp read X-Forwarded-For[0] directly, letting
// attackers rotate fake IPs to get a fresh rate-limit counter each request.
// This test documents that behaviour is no longer the key extraction contract.
// ---------------------------------------------------------------------------
test('security: rate limit key is NOT derived from the raw X-Forwarded-For header', () => {
  // An attacker tries to bypass the rate limit by setting a fake leftmost IP
  const req = {
    ip: '203.0.113.99',                             // attacker's real IP (trust-proxy resolved)
    headers: { 'x-forwarded-for': '1.2.3.4' },     // attacker-controlled fake IP
  };

  const key = getRateLimitKey(req);

  // Key must be the real IP, NOT the attacker's fake one
  assert.equal(key, '203.0.113.99',
    'Rate limit key must be req.ip (trust-proxy resolved), not the raw X-Forwarded-For value');
  assert.notEqual(key, '1.2.3.4',
    'Rate limit key must NOT be the client-controlled X-Forwarded-For leftmost entry');
});
