import picomatch from 'picomatch';

export function globToRegex(pattern) {
  try {
    return picomatch.makeRe(pattern);
  } catch (err) {
    console.warn(`[globToRegex] Failed to parse pattern: ${pattern}. Falling back to default regex.`, err.message);
    // Escape every regex metacharacter FIRST so that characters introduced by
    // the glob conversion below (e.g. the brackets in `[^/]`) are not
    // escaped again and turned into literals.
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\/+/g, '__GLOBSTAR__')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/__GLOBSTAR__/g, '(?:.*/)?');
    return new RegExp(`^${escaped}$`);
  }
}
