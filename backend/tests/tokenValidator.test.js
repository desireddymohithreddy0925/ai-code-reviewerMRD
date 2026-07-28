import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGithubToken } from '../utils/tokenValidator.js';

test('isValidGithubToken accepts valid prefixes and classic tokens', () => {
  assert.equal(isValidGithubToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz'), true);
  assert.equal(isValidGithubToken('github_pat_11AAAAAAA0123456789_abcdefghijklmnopqrstuvwxyz'), true);
  assert.equal(isValidGithubToken('1234567890abcdef1234567890abcdef12345678'), true);
});

test('isValidGithubToken rejects invalid or malformed tokens', () => {
  assert.equal(isValidGithubToken(null), false);
  assert.equal(isValidGithubToken(''), false);
  assert.equal(isValidGithubToken('invalid_prefix_12345'), false);
});
