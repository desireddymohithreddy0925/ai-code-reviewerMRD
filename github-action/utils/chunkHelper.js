/**
 * Helper to split massive unified diffs into smaller chunks.
 * Attempts to split at double newlines (\n\n) or hunk boundaries (@@)
 * to preserve logical boundaries for the LLM.
 */

export class ChunkHelper {
  /**
   * Splits a massive diff text into an array of smaller diff strings.
   * Utilizes Semantic AST-heuristic chunking for JS/TS, Python, and Go files
   * to strictly split at class/function boundaries rather than arbitrary lines!
   * 
   * @param {string} diffText 
   * @param {number} maxLinesPerChunk
   * @param {string} fileExtension (optional)
   * @returns {string[]} Array of diff chunks
   */
  static splitMassiveDiff(diffText, maxLinesPerChunk = 500, fileExtension = '') {
    if (!diffText || typeof diffText !== 'string') return [];

    const lines = diffText.split('\n');
    if (lines.length <= maxLinesPerChunk) {
      return [diffText];
    }

    let boundaryRegex = null;
    const ext = (fileExtension || '').toLowerCase();
    
    if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      // Matches export class, function, const foo = () =>
      boundaryRegex = /^(?:export\s+)?(?:default\s+)?(?:class|function|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>)/;
    } else if (ext === '.py') {
      boundaryRegex = /^(?:async\s+)?(?:def|class)\s+\w+/;
    } else if (ext === '.go') {
      boundaryRegex = /^func\s+|^type\s+\w+\s+(?:struct|interface)/;
    }

    const chunks = [];
    let currentChunk = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // If we have a semantic regex, attempt to split exactly at the class/function signature
      if (boundaryRegex && boundaryRegex.test(line.replace(/^(\+|\-| )/, ''))) {
        if (currentChunk.length >= maxLinesPerChunk * 0.8) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
        }
      } else if (!boundaryRegex && currentChunk.length >= maxLinesPerChunk) {
        // Fallback to hunk boundaries if no language semantic regex matches
        const isLogicalBreak = line.trim() === '' || (i + 1 < lines.length && lines[i + 1].startsWith('@@ '));
        if (isLogicalBreak || currentChunk.length >= maxLinesPerChunk + 100) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
        }
      }

      currentChunk.push(line);
      
      // Hard cutoff to prevent infinite chunks if a single function is over 2000 lines
      if (currentChunk.length >= (maxLinesPerChunk * 2)) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }
}
