const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(\/)?$/;
const GITHUB_URL_WITH_DOT_GIT = /^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+\.git(\/)?$/;

export function isValidRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!GITHUB_URL_PATTERN.test(url) && !GITHUB_URL_WITH_DOT_GIT.test(url)) return false;
  const parts = url.replace(/\/+$/, '').replace(/\.git$/, '').split('/');
  return !parts.some(p => p === '..');
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
