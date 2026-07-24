/**
 * RbacVerifier: Validates if the PR author has sufficient GitHub Repository
 * permissions to alter the `.ai-reviewer.yml` security configuration.
 */

export class RbacVerifier {
  /**
   * Checks if the `.ai-reviewer.yml` configuration file is modified in the PR diff.
   * @param {Array<{path: string}>} diffFiles 
   * @returns {boolean}
   */
  static isConfigModified(diffFiles) {
    if (!diffFiles || !Array.isArray(diffFiles)) return false;
    return diffFiles.some(f => f.path === '.ai-reviewer.yml');
  }

  /**
   * Verifies if a user has 'admin' or 'write' (maintainer) permissions.
   * @param {object} octokit 
   * @param {string} owner 
   * @param {string} repo 
   * @param {string} username 
   * @returns {Promise<boolean>}
   */
  static async isUserAuthorized(octokit, owner, repo, username) {
    if (!username) return false;
    
    try {
      const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username
      });
      
      const permission = response.data.permission;
      // Valid permissions that can alter AI configuration
      return permission === 'admin' || permission === 'write';
    } catch (err) {
      console.warn(`⚠️ [RBAC] Failed to verify permission level for ${username}: ${err.message}`);
      // Default to deny on failure for security
      return false;
    }
  }
}
