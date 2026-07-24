/**
 * DedupHelper: Generates stable hashes for code snippets to deduplicate 
 * AI comments across different PRs in the same repository.
 */
import crypto from 'crypto';

export class DedupHelper {
  /**
   * Generates a normalized SHA-256 hash of a code snippet.
   * Strips all whitespace and forces lowercase to account for minor formatting differences,
   * providing a fast, resilient alternative to full AST signature matching.
   * 
   * @param {string} codeSnippet 
   * @returns {string} hash
   */
  static generateSnippetHash(codeSnippet) {
    if (!codeSnippet) return '';
    const normalized = codeSnippet.replace(/\s+/g, '').toLowerCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Extracts the code snippet from the diff surrounding the comment line
   * so we have a reliable chunk to hash.
   */
  static extractSnippetFromDiff(diffContent, targetLine) {
    if (!diffContent) return '';
    const lines = diffContent.split('\n');
    const start = Math.max(0, targetLine - 3);
    const end = Math.min(lines.length, targetLine + 3);
    return lines.slice(start, end).join('\n');
  }
}
