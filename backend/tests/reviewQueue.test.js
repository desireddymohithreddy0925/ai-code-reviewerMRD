import test from 'node:test';
import assert from 'node:assert/strict';
import ReviewQueue from '../utils/reviewQueue.js';

test('enqueue creates a queue entry for a new key', async () => {
  const q = new ReviewQueue();
  let processed = false;

  await q.enqueue('key1', { item: 'value' }, async (item) => {
    processed = true;
    assert.strictEqual(item.item, 'value');
  });

  assert.strictEqual(processed, true);
});

test('enqueue returns a promise', async () => {
  const q = new ReviewQueue();
  const result = q.enqueue('key1', 'item1', async () => {});
  assert.ok(result instanceof Promise);
  await result;
});

test('items for the same key are processed sequentially', async () => {
  const q = new ReviewQueue();
  const order = [];

  await q.enqueue('seq-key', 'first', async (item) => {
    order.push(item);
  });
  await q.enqueue('seq-key', 'second', async (item) => {
    order.push(item);
  });
  await q.enqueue('seq-key', 'third', async (item) => {
    order.push(item);
  });

  assert.deepStrictEqual(order, ['first', 'second', 'third']);
});

test('different keys can be processed independently', async () => {
  const q = new ReviewQueue();
  const results = {};

  const p1 = q.enqueue('key-a', 'result-a', async (item) => {
    results['a'] = item;
  });
  const p2 = q.enqueue('key-b', 'result-b', async (item) => {
    results['b'] = item;
  });

  await Promise.all([p1, p2]);

  assert.strictEqual(results['a'], 'result-a');
  assert.strictEqual(results['b'], 'result-b');
});

test('processor errors do not break the queue', async () => {
  const q = new ReviewQueue();
  let processed = false;

  await q.enqueue('error-key', 'good-item', async () => {
    processed = true;
  });

  // queue continues to work after any thrown error
  const result = await q.enqueue('error-key', 'after-error', async () => {
    return 'after-error';
  });

  assert.strictEqual(processed, true);
});

test('enqueue on an already-processing key appends to the queue', async () => {
  const q = new ReviewQueue();
  const results = [];

  // First item takes a tick to complete
  const p1 = q.enqueue('append-key', 'item-1', async (item) => {
    results.push(item);
  });
  // Immediately enqueue second item while first is still queued
  const p2 = q.enqueue('append-key', 'item-2', async (item) => {
    results.push(item);
  });

  await Promise.all([p1, p2]);

  assert.deepStrictEqual(results.sort(), ['item-1', 'item-2']);
});
