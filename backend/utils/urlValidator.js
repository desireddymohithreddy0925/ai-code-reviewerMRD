export function isValidRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Reject URLs with control characters, spaces, or null bytes
  if (/[\s\x00-\x1f]/.test(url)) return false;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only accept HTTPS protocol
  if (parsed.protocol !== 'https:') return false;

  // Only accept github.com hostname (no SSRF to arbitrary hosts)
  if (parsed.hostname !== 'github.com') return false;

  // Reject URLs with embedded credentials
  if (parsed.username || parsed.password) return false;

  // Reject URLs with query parameters or fragments (not valid for clone)
  if (parsed.search || parsed.hash) return false;

  // Reject URLs with consecutive slashes in the path
  if (parsed.pathname.includes('//')) return false;

  // Path must be exactly /owner/repo with optional .git suffix or trailing slash
  const path = parsed.pathname.replace(/\/+$/, '').replace(/\.git$/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length !== 2) return false;

  // Each segment: alphanumeric, dot, underscore, hyphen only (GitHub naming rules)
  const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;
  if (!SEGMENT_RE.test(segments[0]) || !SEGMENT_RE.test(segments[1])) return false;

  // Reject path segments starting with hyphen (git short-flag injection)
  if (segments[0].startsWith('-') || segments[1].startsWith('-')) return false;

  // Reject path segments with double-dash (git long-flag injection)
  if (segments[0].includes('--') || segments[1].includes('--')) return false;

  return true;
}

export function parseRepoUrl(url) {
  if (!isValidRepoUrl(url)) return null;
  const cleanUrl = url.replace(/\/+$/, '').replace(/\.git$/, '');
  const parts = cleanUrl.split('/');
  return {
    owner: parts[parts.length - 2],
    repo: parts[parts.length - 1]
  };
}
