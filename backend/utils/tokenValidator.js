export function isValidGithubToken(token) {
  if (!token || typeof token !== 'string') return false;
  // Modern GitHub token formats: ghp_, github_pat_, etc.
  const tokenRegex = /^(ghp_|github_pat_)[a-zA-Z0-9_]+$/;
  return tokenRegex.test(token);
}
