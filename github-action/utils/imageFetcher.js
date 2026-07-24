/**
 * Utility to fetch raw image data from GitHub API and convert to Base64
 * for Multimodal LLM Vision API consumption.
 */
export class ImageFetcher {
  /**
   * Fetches an image blob from GitHub API and returns it as a Base64 string.
   * @param {Object} octokit - Authenticated Octokit instance
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path in the repository
   * @param {string} ref - Commit SHA or branch name (usually head SHA of PR)
   * @returns {Promise<{base64: string, mimeType: string}|null>} 
   */
  static async fetchImageBase64(octokit, owner, repo, path, ref) {
    try {
      // 1. Fetch file content from GitHub API
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      // 2. Validate if it's a file and has content
      if (Array.isArray(data) || data.type !== 'file' || !data.content) {
        console.warn(`⚠️ Path ${path} is not a valid file or lacks content.`);
        return null;
      }
      
      // 3. Ensure file is not massively huge (GitHub API limits to 100MB, but Vision models prefer < 4MB)
      if (data.size > 4 * 1024 * 1024) {
        console.warn(`⚠️ Image file ${path} is too large (${(data.size / 1024 / 1024).toFixed(2)} MB). Skipping Vision review.`);
        return null;
      }

      // 4. GitHub API returns base64 string directly in data.content
      // We just need to determine the mimeType from the extension
      const ext = path.split('.').pop().toLowerCase();
      let mimeType = 'image/png';
      
      if (['jpg', 'jpeg'].includes(ext)) {
        mimeType = 'image/jpeg';
      } else if (ext === 'webp') {
        mimeType = 'image/webp';
      } else if (ext === 'gif') {
        mimeType = 'image/gif';
      } else if (ext === 'excalidraw') {
        // Note: Raw excalidraw files are JSON. If it's literally a .excalidraw file,
        // it cannot be passed directly to a Vision model. But users often export as PNG.
        // We will assume it's JSON text if it's literally .excalidraw, and LLMs can read the JSON.
        // But for Vision, we strictly need image data.
        mimeType = 'application/json';
        if (ext === 'excalidraw') return null; // Vision models cannot "see" raw JSON files
      }

      return {
        base64: data.content.replace(/\n/g, ''), // GitHub API adds newlines to base64
        mimeType
      };
      
    } catch (e) {
      console.warn(`⚠️ Failed to fetch image ${path} from GitHub API: ${e.message}`);
      return null;
    }
  }
}
