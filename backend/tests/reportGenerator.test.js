import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  escapeHtml,
  generateJSONReport,
  generateHTMLReport,
  getReportPath,
  SCHEMA_VERSION,
} from '../utils/reportGenerator.js';

const TEST_OUT_DIR = '/tmp/rg-out-' + Date.now();
fs.mkdirSync(TEST_OUT_DIR, { recursive: true });

test('escapeHtml escapes ampersand', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml escapes less-than', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('escapeHtml escapes greater-than', () => {
  assert.equal(escapeHtml('a > b'), 'a &gt; b');
});

test('escapeHtml escapes double quote', () => {
  assert.equal(escapeHtml('say "hello"'), 'say &quot;hello&quot;');
});

test('escapeHtml escapes single quote', () => {
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('escapeHtml escapes all special chars together', () => {
  assert.equal(
    escapeHtml('<a href="url"> & \'x\' > y</a>'),
    '&lt;a href=&quot;url&quot;&gt; &amp; &#39;x&#39; &gt; y&lt;/a&gt;'
  );
});

test('escapeHtml returns empty string for non-string input', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '');
  assert.equal(escapeHtml({}), '');
});

test('escapeHtml handles empty string', () => {
  assert.equal(escapeHtml(''), '');
});

test('escapeHtml preserves normal text unchanged', () => {
  assert.equal(escapeHtml('hello world'), 'hello world');
});

test('generateJSONReport creates valid report file', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report.json');
  const reviewResult = {
    fileReviews: {
      'src/app.js': {
        bugs: [{ description: 'unused variable', line: 10, rule: 'no-unused-vars' }],
        security: [],
        optimization: [],
        styling: [],
      },
    },
  };
  const result = generateJSONReport('test-repo', ['src/app.js'], reviewResult, outputPath);
  assert.equal(result.success, true);
  assert.equal(result.path, outputPath);
  assert.equal(result.findingCount, 1);
  assert.ok(fs.existsSync(outputPath));
});

test('generateJSONReport counts bugs as errors', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report2.json');
  const reviewResult = {
    fileReviews: {
      'src/app.js': {
        bugs: [{ description: 'bug1' }, { description: 'bug2' }],
        security: [],
        optimization: [],
        styling: [],
      },
    },
  };
  const result = generateJSONReport('test-repo', ['src/app.js'], reviewResult, outputPath);
  assert.equal(result.findingCount, 2);
  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  assert.equal(report.by_severity.error, 2);
});

test('generateJSONReport counts security issues as errors', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report3.json');
  const reviewResult = {
    fileReviews: {
      'src/auth.js': {
        bugs: [],
        security: [{ message: 'sql injection vulnerability', line: 5, rule: 'sql-injection' }],
        optimization: [],
        styling: [],
      },
    },
  };
  const result = generateJSONReport('test-repo', ['src/auth.js'], reviewResult, outputPath);
  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  assert.equal(report.by_severity.error, 1);
  assert.equal(report.by_category.security, 1);
});

test('generateJSONReport counts optimization as warnings', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report4.json');
  const reviewResult = {
    fileReviews: {
      'src/slow.js': {
        bugs: [],
        security: [],
        optimization: [{ description: 'slow loop', line: 20, rule: 'slow-loop' }],
        styling: [],
      },
    },
  };
  const result = generateJSONReport('test-repo', ['src/slow.js'], reviewResult, outputPath);
  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  assert.equal(report.by_severity.warning, 1);
});

test('generateJSONReport counts styling as info', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report5.json');
  const reviewResult = {
    fileReviews: {
      'src/style.js': {
        bugs: [],
        security: [],
        optimization: [],
        styling: [{ description: 'missing semicolon', line: 1, rule: 'semi' }],
      },
    },
  };
  const result = generateJSONReport('test-repo', ['src/style.js'], reviewResult, outputPath);
  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  assert.equal(report.by_severity.info, 1);
});

test('generateJSONReport handles empty reviewResult', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report6.json');
  const result = generateJSONReport('test-repo', ['src/app.js'], {}, outputPath);
  assert.equal(result.success, true);
  assert.equal(result.findingCount, 0);
  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  assert.equal(report.total_findings, 0);
  assert.equal(report.by_severity.error, 0);
});

test('generateJSONReport handles missing fields in issue', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report7.json');
  const reviewResult = {
    fileReviews: {
      'src/app.js': {
        bugs: [{ line: 1 }], // no description or rule
        security: [],
        optimization: [],
        styling: [],
      },
    },
  };
  const result = generateJSONReport('test-repo', ['src/app.js'], reviewResult, outputPath);
  assert.equal(result.success, true);
  const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  assert.equal(report.findings[0].message, '');
  assert.equal(report.findings[0].rule_id, 'unknown');
});

test('generateJSONReport returns error on write failure', () => {
  const result = generateJSONReport('test-repo', ['src/app.js'], {}, '/nonexistent/path/report.json');
  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
});

test('generateHTMLReport creates valid HTML file', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report.html');
  const result = generateHTMLReport('test-repo', ['src/app.js'], {}, outputPath);
  assert.equal(result.success, true);
  assert.ok(fs.existsSync(outputPath));
  const content = fs.readFileSync(outputPath, 'utf-8');
  assert.ok(content.includes('<!DOCTYPE html>'));
  assert.ok(content.includes('test-repo'));
  assert.ok(content.includes('No findings'));
});

test('generateHTMLReport includes severity colors and findings', () => {
  const outputPath = path.join(TEST_OUT_DIR, 'report2.html');
  const reviewResult = {
    fileReviews: {
      'src/buggy.js': {
        bugs: [{ description: 'bug', line: 1, rule: 'bug' }],
        security: [],
        optimization: [],
        styling: [],
      },
    },
  };
  generateHTMLReport('test-repo', ['src/buggy.js'], reviewResult, outputPath);
  const content = fs.readFileSync(outputPath, 'utf-8');
  assert.ok(content.includes('#ff4444')); // error color
  assert.ok(content.includes('buggy.js'));
});

test('generateHTMLReport returns error on write failure', () => {
  const result = generateHTMLReport('test-repo', [], {}, '/nonexistent/out.html');
  assert.equal(result.success, false);
  assert.ok(result.error !== undefined);
});

test('getReportPath returns correct json extension', () => {
  const p = getReportPath('json', '/tmp');
  assert.ok(p.endsWith('.json'));
  assert.ok(p.includes('review-report'));
});

test('getReportPath returns correct html extension', () => {
  const p = getReportPath('html', '/tmp');
  assert.ok(p.endsWith('.html'));
});

test('SCHEMA_VERSION is defined as 1.0', () => {
  assert.equal(SCHEMA_VERSION, '1.0');
});
