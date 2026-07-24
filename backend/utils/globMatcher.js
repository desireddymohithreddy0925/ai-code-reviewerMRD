import picomatch from 'picomatch';

/**
 * Creates an optimized AST-based matching function for the given patterns.
 * We use `picomatch` which evaluates significantly faster than custom Regex.
 * @param {string|string[]} patterns The glob pattern(s) to match against
 * @param {object} options Optional picomatch options
 * @returns {Function} A function `(string) => boolean`
 */
export function createGlobMatcher(patterns, options = {}) {
  // dot: true ensures we match hidden files (e.g. .env) unless explicitly ignored
  return picomatch(patterns, { dot: true, ...options });
}

/**
 * Convenience method to test if a single file matches any of the patterns.
 * Prefer `createGlobMatcher` outside of loops for high performance.
 * @param {string} filePath 
 * @param {string|string[]} patterns 
 * @returns {boolean}
 */
export function isGlobMatch(filePath, patterns) {
  return picomatch.isMatch(filePath, patterns, { dot: true });
}
