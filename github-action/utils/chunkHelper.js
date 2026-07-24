/**
 * Helper to split massive unified diffs into smaller chunks.
 * Attempts to split at double newlines (\n\n) or hunk boundaries (@@)
 * to preserve logical boundaries for the LLM.
 */

export class ChunkHelper {
  /**
   * Splits a massive diff text into an array of smaller diff strings.
   * @param {string} diffText 
   * @param {number} maxLinesPerChunk
   * @returns {string[]} Array of diff chunks
   */
  static splitMassiveDiff(diffText, maxLinesPerChunk = 500) {
    if (!diffText || typeof diffText !== 'string') return [];

    const lines = diffText.split('\n');
    if (lines.length <= maxLinesPerChunk) {
      return [diffText];
    }

    const chunks = [];
    let currentChunk = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // If we've reached the target chunk size, look for a logical break point
      if (currentChunk.length >= maxLinesPerChunk) {
        // Look ahead for an empty line or a new hunk header (@@)
        const isLogicalBreak = line.trim() === '' || (i + 1 < lines.length && lines[i + 1].startsWith('@@ '));
        
        if (isLogicalBreak || currentChunk.length >= maxLinesPerChunk + 100) {
          // Force break if we exceed maxLines + 100 to avoid infinite looping
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
        }
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }
}
