import test from 'node:test';
import assert from 'node:assert/strict';
import DedupStore from '../utils/dedupStore.js';

test('DedupStore: operates in-memory when Redis is not provided', async () => {
  const store = new DedupStore();

  await store.set('key1', 'val1', 5000);
  assert.equal(await store.get('key1'), 'val1');

  await store.delete('key1');
  assert.equal(await store.get('key1'), null);
});

test('DedupStore: expires memory entries after TTL', async () => {
  const store = new DedupStore();

  await store.set('key1', 'val1', 10);
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(await store.get('key1'), null);
});

test('DedupStore: set operations (addToSet, isMember, removeFromSet) behave correctly in memory', async () => {
  const store = new DedupStore();

test('DedupStore: sets and gets values in memory when Redis is absent', async () => {
  const store = new DedupStore();
  await store.set('key1', 'value1', 100);
  
  assert.equal(await store.get('key1'), 'value1');
  
  // Wait for expiration
  await new Promise(r => setTimeout(r, 120));
  assert.equal(await store.get('key1'), null);
});

test('DedupStore: sets, membership and expiration in set checks', async () => {
  const store = new DedupStore();
  await store.addToSet('set1', 'member1');
  await store.addToSet('set1', 'member2');

  assert.equal(await store.isMember('set1', 'member1'), true);
  assert.equal(await store.isMember('set1', 'member2'), true);
  assert.equal(await store.isMember('set1', 'member3'), false);

  await store.removeFromSet('set1', 'member1');
  assert.equal(await store.isMember('set1', 'member1'), false);
  assert.equal(await store.isMember('set1', 'member2'), true);
});

test('DedupStore: handles type transitions safely without throwing TypeError', async () => {
  const store = new DedupStore();

  // 1. Set key as a string
  await store.set('mixedKey', 'not-a-set', 5000);

  // 2. Call isMember and removeFromSet on it — should handle it safely
  assert.equal(await store.isMember('mixedKey', 'member'), false);
  
  // 3. Should delete or ignore smoothly
  await store.removeFromSet('mixedKey', 'member');
  
  // 4. Calling addToSet should safely overwrite/re-initialize the value as a Set
  await store.addToSet('mixedKey', 'member');
  assert.equal(await store.isMember('mixedKey', 'member'), true);
  // Expire the key in memory
  await store.expire('set1', 20);
  assert.equal(await store.isMember('set1', 'member1'), true);

  // Wait for expiration
  await new Promise(r => setTimeout(r, 30));
  assert.equal(await store.isMember('set1', 'member1'), false, 'Should return false after expiration');
  assert.equal(await store.has('set1'), false, 'Should be fully evicted');
});
