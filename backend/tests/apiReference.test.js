import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import apiRouter from '../routes/apiReference.js';

test('apiReference router exports a valid express Router with /analyze endpoint', () => {
  const app = express();
  app.use('/api', apiRouter);

  assert.equal(typeof apiRouter, 'function');
  assert.ok(apiRouter.stack.some(layer => layer.route && layer.route.path === '/analyze'));
});
