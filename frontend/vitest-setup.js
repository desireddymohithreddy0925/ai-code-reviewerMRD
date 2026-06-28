// vitest-setup.js
// Configure DOMPurify to work in jsdom (Node.js) environment before tests run
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});

// Patch global window and document so DOMPurify picks them up automatically
global.window = dom.window;
global.document = dom.window.document;
