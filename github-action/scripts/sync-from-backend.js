import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const pairs = [
  { src: 'backend/utils/secretsScanner.js', dest: 'github-action/utils/secretsScanner.js' },
  { src: 'backend/utils/diffParser.js', dest: 'github-action/utils/diffParser.js' },
  { src: 'backend/utils/ipynbParser.js', dest: 'github-action/utils/ipynbParser.js' },
  { src: 'backend/utils/sandboxVerifier.js', dest: 'github-action/utils/sandboxVerifier.js' },
  { src: 'backend/utils/dependencyGraph.js', dest: 'github-action/utils/dependencyGraph.js' },
  { src: 'backend/utils/firewall.js', dest: 'github-action/utils/firewall.js' },
  { src: 'backend/utils/semanticChunker.js', dest: 'github-action/utils/semanticChunker.js' },
  { src: 'backend/utils/dependencyParser.js', dest: 'github-action/utils/dependencyParser.js' },
  { src: 'backend/utils/coverageParser.js', dest: 'github-action/utils/coverageParser.js' },
  { src: 'backend/utils/imageFetcher.js', dest: 'github-action/utils/imageFetcher.js' },
  { src: 'shared-safety-config.json', dest: 'github-action/shared-safety-config.json' },
];

let ok = true;
for (const { src, dest } of pairs) {
  const srcPath = resolve(repoRoot, src);
  const destPath = resolve(repoRoot, dest);
  if (!existsSync(srcPath)) {
    console.error(`[sync] ERROR: Source not found: ${srcPath}`);
    ok = false;
    continue;
  }
  copyFileSync(srcPath, destPath);
  console.log(`[sync] Copied ${src} -> ${dest}`);
}

if (!ok) {
  console.error('[sync] Some files could not be synced.');
  process.exit(1);
}
console.log('[sync] All files synced successfully.');
