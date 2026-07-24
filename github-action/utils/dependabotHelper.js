/**
 * DependabotHelper: Utilities for parsing Dependabot PRs and extracting
 * package bump information and official release notes.
 */

export class DependabotHelper {
  /**
   * Checks if the PR author is dependabot.
   * @param {string} username 
   * @returns {boolean}
   */
  static isDependabotPR(username) {
    return username === 'dependabot[bot]';
  }

  /**
   * Extracts package name and version bumps from Dependabot PR titles.
   * Example: "Bump axios from 0.21.1 to 1.0.0" -> { pkg: "axios", from: "0.21.1", to: "1.0.0" }
   * @param {string} title 
   * @returns {object|null}
   */
  static extractPackageBump(title) {
    if (!title) return null;
    
    // Pattern 1: Bump <pkg> from <v1> to <v2>
    const bumpRegex = /Bump\s+(.+?)\s+from\s+(v?[\d\.]+)\s+to\s+(v?[\d\.]+)/i;
    const match = title.match(bumpRegex);
    
    if (match) {
      return {
        pkg: match[1].trim(),
        from: match[2],
        to: match[3]
      };
    }
    
    return null;
  }

  /**
   * Scrapes the release notes/changelog from the Dependabot PR body.
   * Dependabot includes release notes inside `<details>` tags.
   * We extract it and truncate to 4000 chars to avoid exhausting LLM tokens.
   * 
   * @param {string} prBody 
   * @returns {string|null}
   */
  static extractReleaseNotesFromBody(prBody) {
    if (!prBody) return null;
    
    // Dependabot typically wraps release notes in:
    // <details>
    // <summary>Release notes</summary>
    // ...content...
    // </details>
    
    const releaseNotesRegex = /<summary>Release notes<\/summary>([\s\S]*?)<\/details>/i;
    const match = prBody.match(releaseNotesRegex);
    
    if (match && match[1]) {
      let content = match[1].trim();
      
      // Strip HTML tags for clean markdown
      content = content.replace(/<\/?[^>]+(>|$)/g, "");
      
      // Truncate to 4000 characters max
      if (content.length > 4000) {
        content = content.substring(0, 4000) + '... (truncated due to length)';
      }
      
      return content;
    }
    
    return null;
  }
}
