import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function withTempDir(fn) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'reposage-test-'));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Tests for parseIgnoreFile
// ---------------------------------------------------------------------------

test('parseIgnoreFile returns empty array for non-existent file path', async () => {
  const { parseIgnoreFile } = await import('../utils/reposageIgnore.js');
  const result = parseIgnoreFile('/nonexistent/path/.reposageignore');
  assert.deepEqual(result, []);
});

test('parseIgnoreFile strips comment lines starting with #', async () => {
  const { parseIgnoreFile } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '# This is a comment\n*.log\n# Another comment\nnode_modules/\n');
    const result = parseIgnoreFile(ignorePath);
    assert.equal(result.length, 2);
    assert.ok(!result.includes('# This is a comment'));
    assert.ok(!result.includes('# Another comment'));
    assert.ok(result.includes('*.log'));
    assert.ok(result.includes('node_modules/'));
  });
});

test('parseIgnoreFile strips blank lines', async () => {
  const { parseIgnoreFile } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '\n\n*.js\n\n  \n\nnode_modules/\n');
    const result = parseIgnoreFile(ignorePath);
    assert.equal(result.length, 2);
    assert.ok(result.includes('*.js'));
    assert.ok(result.includes('node_modules/'));
  });
});

test('parseIgnoreFile trims whitespace from each pattern', async () => {
  const { parseIgnoreFile } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '  *.js  \n  node_modules/  \n');
    const result = parseIgnoreFile(ignorePath);
    assert.equal(result[0], '*.js');
    assert.equal(result[1], 'node_modules/');
  });
});

test('parseIgnoreFile preserves non-comment non-blank patterns', async () => {
  const { parseIgnoreFile } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    const content = '*.js\n*.log\nnode_modules/\n.git/\n**/*.pyc';
    await fs.promises.writeFile(ignorePath, content);
    const result = parseIgnoreFile(ignorePath);
    assert.equal(result.length, 5);
    assert.ok(result.includes('*.js'));
    assert.ok(result.includes('*.log'));
    assert.ok(result.includes('node_modules/'));
    assert.ok(result.includes('.git/'));
    assert.ok(result.includes('**/*.pyc'));
  });
});

test('parseIgnoreFile treats lines starting with # as comments regardless of content', async () => {
  const { parseIgnoreFile } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '#not really a comment\nreal-entry\n# real-entry-but-comment');
    const result = parseIgnoreFile(ignorePath);
    assert.deepEqual(result, ['real-entry']);
  });
});

// ---------------------------------------------------------------------------
// Tests for globToRegex
// ---------------------------------------------------------------------------

test('globToRegex anchors patterns with ^ and $', async () => {
  const { globToRegex } = await import('../utils/reposageIgnore.js');
  const regex = globToRegex('build');
  assert.ok(regex.test('build'), 'anchored pattern should match build');
  assert.ok(!regex.test('ibuild'), 'anchored pattern should not match ibuild');
  assert.ok(!regex.test('builder'), 'anchored pattern should not match builder');
});

test('globToRegex escapes dots', async () => {
  const { globToRegex } = await import('../utils/reposageIgnore.js');
  const regex = globToRegex('*.tmp');
  assert.ok(regex.test('.tmp'), '*.tmp should match .tmp');
  assert.ok(!regex.test('filetmp'), '*.tmp should not match filetmp (escaped dot)');
  assert.ok(regex.test('debug.tmp'), '*.tmp should match debug.tmp');
});

test('globToRegex converts single * to [^/]*', async () => {
  const { globToRegex } = await import('../utils/reposageIgnore.js');
  const regex = globToRegex('*.log');
  assert.ok(regex.test('debug.log'), '*.log should match debug.log');
  assert.ok(!regex.test('dir/debug.log'), '*.log should not match dir/debug.log (contains /)');
  assert.ok(!regex.test('debug.log.bak'), '*.log should not match debug.log.bak');
});

test('globToRegex handles ** for mid-path wildcards', async () => {
  const { globToRegex } = await import('../utils/reposageIgnore.js');
  // src/test/** should match src/test/file.js and src/test/a/b.js
  const regex = globToRegex('src/test/**');
  assert.ok(regex.test('src/test/file.js'), 'src/test/** should match src/test/file.js');
  assert.ok(regex.test('src/test/a/b/c.js'), 'src/test/** should match src/test/a/b/c.js');
  assert.ok(!regex.test('src/other/file.js'), 'src/test/** should not match src/other/file.js');
});

test('globToRegex handles ** with a trailing segment', async () => {
  const { globToRegex } = await import('../utils/reposageIgnore.js');
  // build/**/*.js should match build/file.js and build/src/file.js
  const regex = globToRegex('build/**/*.js');
  assert.ok(regex.test('build/file.js'), 'build/**/*.js should match build/file.js');
  assert.ok(regex.test('build/src/file.js'), 'build/**/*.js should match build/src/file.js');
  assert.ok(!regex.test('src/file.js'), 'build/**/*.js should not match src/file.js');
});

// ---------------------------------------------------------------------------
// Tests for shouldIgnore
// ---------------------------------------------------------------------------

test('shouldIgnore returns false when no .reposageignore file exists in repoRoot', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const result = shouldIgnore('src/app.js', tmpDir);
    assert.equal(result, false);
  });
});

test('shouldIgnore returns true for exact filename match', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.js\n');
    const result = shouldIgnore('src/app.js', tmpDir);
    assert.equal(result, true);
  });
});

test('shouldIgnore returns true for ** double-star glob', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '**/*.pyc\n');
    const result = shouldIgnore('src/cache/file.pyc', tmpDir);
    assert.equal(result, true);
  });
});

test('shouldIgnore returns true for trailing slash directory pattern', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, 'node_modules/\n');
    const result = shouldIgnore('node_modules/package/index.js', tmpDir);
    assert.equal(result, true);
  });
});

test('shouldIgnore matches basename against pattern', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, 'node_modules\n');
    // shouldIgnore also matches basename against pattern (not just full path)
    const result = shouldIgnore('node_modules', tmpDir);
    assert.equal(result, true);
  });
});

test('shouldIgnore returns false for non-matching paths', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.py\n');
    const result = shouldIgnore('src/app.js', tmpDir);
    assert.equal(result, false);
  });
});

test('shouldIgnore handles paths with backslashes by normalizing to forward slashes', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.js\n');
    // path with backslashes
    const result = shouldIgnore('src\\app.js', tmpDir);
    // Should normalize and match
    assert.equal(result, true);
  });
});

test('shouldIgnore handles empty patterns array (no .reposageignore content)', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '# only comments\n# another comment\n');
    const result = shouldIgnore('src/app.js', tmpDir);
    assert.equal(result, false);
  });
});

test('shouldIgnore matches pattern with asterisk wildcard', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.test.js\n');
    const result = shouldIgnore('helpers.test.js', tmpDir);
    assert.equal(result, true);
  });
});

test('shouldIgnore does not match when path does not match pattern', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.test.js\n');
    const result = shouldIgnore('helpers.js', tmpDir);
    assert.equal(result, false);
  });
});

test('shouldIgnore throws TypeError when filePath is null', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.js\n');
    try {
      shouldIgnore(null, tmpDir);
      assert.fail('Expected TypeError to be thrown');
    } catch (e) {
      assert.ok(e instanceof TypeError, 'Should throw TypeError');
      assert.ok(e.message.includes('replace'), 'Error relates to string operation');
    }
  });
});

test('shouldIgnore returns false for empty filePath input', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, '*.js\n');
    const result = shouldIgnore('', tmpDir);
    assert.equal(result, false);
  });
});

test('shouldIgnore directory segment matching with trailing slash', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, 'build/\n');
    const result = shouldIgnore('build/output.js', tmpDir);
    assert.equal(result, true);
  });
});

test('shouldIgnore directory pattern matches any file in that directory', async () => {
  const { shouldIgnore } = await import('../utils/reposageIgnore.js');
  await withTempDir(async (tmpDir) => {
    const ignorePath = path.join(tmpDir, '.reposageignore');
    await fs.promises.writeFile(ignorePath, 'temp/\n');
    const result = shouldIgnore('temp/repo/file.txt', tmpDir);
    assert.equal(result, true);
  });
});
