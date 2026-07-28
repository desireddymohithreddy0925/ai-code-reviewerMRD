export function globToRegex(pattern) {
  let regexStr = '^';
  let i = 0;
  const escapeRegex = (ch) => ch.replace(/[\\^$+?.()|[\]{}]/g, '\\$&');

  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (i + 1 < pattern.length && pattern[i + 1] === '*') {
        if (i + 2 < pattern.length && pattern[i + 2] === '/') {
          regexStr += '(?:.*/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else {
        regexStr += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regexStr += '[^/]';
      i++;
    } else if (ch === '/') {
      regexStr += '/';
      i++;
    } else {
      regexStr += escapeRegex(ch);
      i++;
    }
  }

  regexStr += '$';
  return new RegExp(regexStr);
}
