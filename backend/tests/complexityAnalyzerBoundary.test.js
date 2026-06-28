import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeComplexity } from '../utils/complexityAnalyzer.js';

// Helper: build a string of exactly n newlines (n lines)
function lines(n) {
  return '\n'.repeat(n);
}

// Helper: generate JS function declarations for a given count
function jsFunctions(n) {
  return Array.from({ length: n }, (_, i) => `function fn${i}() { return ${i}; }`).join('\n');
}

test('grade B transition: score 9 (>8) returns grade B', () => {
  // score = round(0/25 + 3*3) = 9
  const result = analyzeComplexity(jsFunctions(3), 'index.js');
  assert.strictEqual(result.grade, 'B');
  assert.strictEqual(result.complexityScore, 9);
});

test('grade A/B boundary: score 6 (not >8) returns grade A', () => {
  // score = round(0/25 + 2*3) = 6
  const result = analyzeComplexity(jsFunctions(2), 'index.js');
  assert.strictEqual(result.grade, 'A');
  assert.strictEqual(result.complexityScore, 6);
});

test('grade C transition: score 16 (>15) returns grade C', () => {
  // score = round(400/25 + 0) = 16
  const result = analyzeComplexity(lines(400), 'index.js');
  assert.strictEqual(result.grade, 'C');
  assert.strictEqual(result.complexityScore, 16);
});

test('grade B/C boundary: score 15 (not >15) returns grade B', () => {
  // score = round(0/25 + 5*3) = 15
  const result = analyzeComplexity(jsFunctions(5), 'index.js');
  assert.strictEqual(result.complexityScore, 15);
  assert.strictEqual(result.grade, 'B');
});

test('grade D transition: score 26 (>25) returns grade D', () => {
  // score = round(200/25 + 0) = 8 (only 200 lines → score=8 → grade B)
  // Wait: round(200/25) = round(8) = 8 → not > 25... need more lines
  // To get score 26 with 0 functions: 26*25 = 650 lines
  // Verify: round(650/25) = round(26) = 26 → >25 → grade D
  const result = analyzeComplexity(lines(650), 'index.js');
  assert.strictEqual(result.complexityScore, 26);
  assert.strictEqual(result.grade, 'D');
});

test('grade C/D boundary: score 25 (not >25) returns grade C', () => {
  // To get score 25 with 0 functions: 25*25 = 625 lines
  // Verify: round(625/25) = round(25) = 25 → not >25 → grade C
  const result = analyzeComplexity(lines(625), 'index.js');
  assert.strictEqual(result.complexityScore, 25);
  assert.strictEqual(result.grade, 'C');
});

test('grade F transition: score 41 (>40) returns grade F', () => {
  // To get score 41 with 0 functions: 41*25 = 1025 lines
  // Verify: round(1025/25) = round(41) = 41 → >40 → grade F
  const result = analyzeComplexity(lines(1025), 'index.js');
  assert.strictEqual(result.complexityScore, 41);
  assert.strictEqual(result.grade, 'F');
});

test('grade D/F boundary: score 40 (not >40) returns grade D', () => {
  // To get score 40 with 0 functions: 40*25 = 1000 lines
  // Verify: round(1000/25) = round(40) = 40 → not >40 → grade D
  const result = analyzeComplexity(lines(1000), 'index.js');
  assert.strictEqual(result.complexityScore, 40);
  assert.strictEqual(result.grade, 'D');
});

test('file with zero lines returns grade A', () => {
  const result = analyzeComplexity('', 'empty.js');
  assert.strictEqual(result.totalLines, 0);
  assert.strictEqual(result.grade, 'A');
  assert.strictEqual(result.complexityScore, 0);
});

test('file with only whitespace returns grade A', () => {
  const result = analyzeComplexity('   \n\n   \n', 'whitespace.js');
  assert.strictEqual(result.grade, 'A');
});

test('file where all lines are Python comments returns grade A with zero codeLines', () => {
  // Python uses # for single-line comments; file is .py so scanner uses Python rules
  const code = '# comment line\n# another comment\n#\n#   indented comment\n# last comment\n';
  const result = analyzeComplexity(code, 'all_comments.py');
  assert.strictEqual(result.codeLines, 0);
  assert.strictEqual(result.functionCount, 0);
  assert.strictEqual(result.grade, 'A');
});

test('null language argument does not throw and returns valid structure', () => {
  assert.doesNotThrow(() => {
    const result = analyzeComplexity('const x = 1;', null);
    assert.strictEqual(typeof result.grade, 'string');
    assert.strictEqual(typeof result.complexityScore, 'number');
  });
});

test('undefined language argument does not throw and returns valid structure', () => {
  assert.doesNotThrow(() => {
    const result = analyzeComplexity('const y = 2;', undefined);
    assert.strictEqual(typeof result.grade, 'string');
    assert.strictEqual(typeof result.complexityScore, 'number');
  });
});
