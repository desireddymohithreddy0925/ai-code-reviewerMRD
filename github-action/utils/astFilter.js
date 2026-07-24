import { Parser } from 'web-tree-sitter';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let parserInstance = null;
let jsLanguage = null;

/**
 * Downloads a file if it doesn't exist
 */
async function downloadFile(url, dest) {
  if (fs.existsSync(dest)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(dest, buffer);
}

/**
 * Initializes the web-tree-sitter parser
 */
export async function initParser() {
  if (parserInstance) return parserInstance;
  try {
    await Parser.init();
    
    // Download the javascript WASM grammar dynamically to keep bundle size small
    const wasmDir = path.join(os.tmpdir(), 'tree-sitter-wasms');
    if (!fs.existsSync(wasmDir)) {
      fs.mkdirSync(wasmDir, { recursive: true });
    }
    
    const jsWasmPath = path.join(wasmDir, 'tree-sitter-javascript.wasm');
    await downloadFile('https://unpkg.com/tree-sitter-javascript-wasm/tree-sitter-javascript.wasm', jsWasmPath);
    
    jsLanguage = await Parser.Language.load(jsWasmPath);
    parserInstance = new Parser();
    parserInstance.setLanguage(jsLanguage);
    
    return parserInstance;
  } catch (err) {
    console.warn(`⚠️ Failed to initialize web-tree-sitter: ${err.message}`);
    return null;
  }
}

/**
 * Strips formatting tokens (like spaces/newlines) and returns a structural string
 */
function getStructuralString(node) {
  if (!node) return '';
  let str = node.type;
  if (node.childCount === 0) {
    str += `:${node.text.trim()}`;
  }
  for (let i = 0; i < node.childCount; i++) {
    str += `[${getStructuralString(node.child(i))}]`;
  }
  return str;
}

/**
 * Compares two blocks of code to see if they are structurally identical
 * Returns true if changes are purely formatting/whitespace.
 */
export async function isPureFormatting(oldCode, newCode, fileName) {
  // We only support JS/TS for now to avoid downloading 20 different WASM binaries
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext !== 'js' && ext !== 'jsx' && ext !== 'ts' && ext !== 'tsx') {
    return false; // Fallback to standard diffing
  }

  const parser = await initParser();
  if (!parser) return false;

  try {
    const oldTree = parser.parse(oldCode);
    const newTree = parser.parse(newCode);

    const oldStructure = getStructuralString(oldTree.rootNode);
    const newStructure = getStructuralString(newTree.rootNode);

    // If the semantic structure is identical, the change is just formatting
    return oldStructure === newStructure;
  } catch (err) {
    console.warn(`⚠️ AST parsing failed for ${fileName}: ${err.message}`);
    return false;
  }
}
