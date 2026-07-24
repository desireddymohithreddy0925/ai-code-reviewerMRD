import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSuggestionBlock, stripSuggestionBlock, verifySuggestionSyntax } from '../utils/sandboxVerifier.js';

test('extractSuggestionBlock returns null if no suggestion', () => {
  const comment = "This is a comment without a suggestion.";
  assert.equal(extractSuggestionBlock(comment), null);
});

test('extractSuggestionBlock extracts suggestion block correctly', () => {
  const comment = "Here is a fix:\n```suggestion\nconst x = 1;\nconsole.log(x);\n```\nHope it helps.";
  const suggestion = extractSuggestionBlock(comment);
  assert.equal(suggestion, "const x = 1;\nconsole.log(x);");
});

test('stripSuggestionBlock replaces suggestion with warning', () => {
  const comment = "Here is a fix:\n```suggestion\nconst x = 1;\n```\nHope it helps.";
  const stripped = stripSuggestionBlock(comment, "SyntaxError: Unexpected identifier");
  assert.ok(stripped.includes('RepoSage Warning'));
  assert.ok(stripped.includes('SyntaxError: Unexpected identifier'));
  assert.equal(stripped.includes('```suggestion'), false);
});

test('verifySuggestionSyntax passes valid JS', () => {
  const code = "const a = 1; function foo() { return a; } foo();";
  const result = verifySuggestionSyntax("test.js", code);
  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
});

test('verifySuggestionSyntax fails invalid JS', () => {
  const code = "const a = 1; function foo() { return a; foo();"; // Missing brace
  const result = verifySuggestionSyntax("test.js", code);
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('SyntaxError'));
});

test('verifySuggestionSyntax bypasses non-JS files', () => {
  const code = "def foo():\n  print('Python!')";
  const result = verifySuggestionSyntax("test.py", code);
  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
});
