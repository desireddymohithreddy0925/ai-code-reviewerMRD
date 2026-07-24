export class DiffMinifier {
  /**
   * Minifies a unified diff by stripping block comments, license headers, 
   * and trailing inline comments while strictly preserving line numbers.
   * 
   * It does this by replacing stripped text with empty spaces/newlines.
   * 
   * @param {string} diffText Raw unified diff text
   * @param {boolean} ignoreComments Whether to strip comments
   * @returns {string} Minified diff text
   */
  static minifyDiff(diffText, ignoreComments = true) {
    if (!diffText || typeof diffText !== 'string') return '';
    
    let minified = diffText;

    if (ignoreComments) {
      // 1. Strip block comments (/* ... */) while preserving newlines
      // Regex matches /* followed by anything (lazy) up to */
      // We use a replacer function to count newlines in the match and return that many newlines
      minified = minified.replace(/\/\*[\s\S]*?\*\//g, (match) => {
        const newlines = match.match(/\n/g);
        return newlines ? newlines.join('') : '';
      });

      // 2. Strip HTML/XML block comments (<!-- ... -->)
      minified = minified.replace(/<!--[\s\S]*?-->/g, (match) => {
        const newlines = match.match(/\n/g);
        return newlines ? newlines.join('') : '';
      });

      // 3. Strip trailing single-line comments (// ..., # ...)
      // We only strip them if they are at the end of the line, keeping the line structure intact.
      // We must avoid stripping URLs like http://
      // Note: In diffs, lines start with +, -, or space.
      // This is a basic heuristic that catches most trivial inline comments without breaking code.
      minified = minified.replace(/(^[\+\-\s].*?)(\/\/|#\s)(?!\/).*$/gm, '$1');
    }

    return minified;
  }
}
