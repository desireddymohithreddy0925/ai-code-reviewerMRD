import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deleteFolderRecursive } from '../utils/fileHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('deleteFolderRecursive does not throw for non-existent directory', async () => {
  try {
    await deleteFolderRecursive(path.join(__dirname, 'non_existent_dir_12345'));
    assert.ok(true);
  } catch (err) {
    assert.fail('Should not throw for non-existent directory');
  }
});

test('deleteFolderRecursive removes all files and subdirectories', async () => {
  const tempDir = path.join(__dirname, 'temp_delete_test');
  // Create nested structure
  fs.mkdirSync(path.join(tempDir, 'sub1', 'sub2'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'sub1', 'sub3'));
  fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
  fs.writeFileSync(path.join(tempDir, 'sub1', 'file2.txt'), 'content2');
  fs.writeFileSync(path.join(tempDir, 'sub1', 'sub2', 'file3.txt'), 'content3');
  fs.writeFileSync(path.join(tempDir, 'sub1', 'sub3', 'file4.txt'), 'content4');

  // Verify structure exists
  assert.ok(fs.existsSync(tempDir), 'temp directory should exist before deletion');
  assert.ok(fs.existsSync(path.join(tempDir, 'file1.txt')), 'file1 should exist');
  assert.ok(fs.existsSync(path.join(tempDir, 'sub1', 'sub2')), 'sub2 should exist');

  // Delete
  await deleteFolderRecursive(tempDir);

  // Verify complete removal
  assert.ok(!fs.existsSync(tempDir), 'temp directory should not exist after deletion');
  assert.ok(!fs.existsSync(path.join(tempDir, 'file1.txt')), 'file1 should be removed');
  assert.ok(!fs.existsSync(path.join(tempDir, 'sub1', 'sub2', 'file3.txt')), 'file3 should be removed');
});

test('deleteFolderRecursive handles directory with only files', async () => {
  const tempDir = path.join(__dirname, 'temp_delete_files_only');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'a.txt'), 'a');
  fs.writeFileSync(path.join(tempDir, 'b.txt'), 'b');
  fs.writeFileSync(path.join(tempDir, 'c.txt'), 'c');

  assert.ok(fs.existsSync(tempDir), 'directory should exist');

  await deleteFolderRecursive(tempDir);

  assert.ok(!fs.existsSync(tempDir), 'directory should be fully removed');
});

test('deleteFolderRecursive handles directory with only empty subdirectories', async () => {
  const tempDir = path.join(__dirname, 'temp_delete_empty_dirs');
  fs.mkdirSync(path.join(tempDir, 'empty1'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'empty2'), { recursive: true });

  assert.ok(fs.existsSync(tempDir), 'directory should exist');

  await deleteFolderRecursive(tempDir);

  assert.ok(!fs.existsSync(tempDir), 'directory should be fully removed');
});
