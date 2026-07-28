import test from 'node:test';
import assert from 'node:assert/strict';
import { globToRegex } from '../utils/globToRegex.js';

test('globToRegex: handles single wildcard *', () => {
  const regex = globToRegex('*.js');
  assert.equal(regex.test('index.js'), true);
  assert.equal(regex.test('src/index.js'), false);
});

test('globToRegex: handles question mark ?', () => {
  const regex = globToRegex('file?.js');
  assert.equal(regex.test('file1.js'), true);
  assert.equal(regex.test('file12.js'), false);
});

test('globToRegex: handles globstar **/ correctly without over-matching or required slash', () => {
  const regex = globToRegex('src/**/*.js');
  assert.equal(regex.test('src/index.js'), true);
  assert.equal(regex.test('src/utils/math.js'), true);
  assert.equal(regex.test('src/utils/deep/helper.js'), true);
  assert.equal(regex.test('other/index.js'), false);
});
