import fs from 'node:fs';
import path from 'node:path';

export class SarifParser {
  constructor(sarifPath) {
    this.enabled = false;
    this.sarifData = null;
    
    if (sarifPath && fs.existsSync(sarifPath)) {
      try {
        const fileContent = fs.readFileSync(sarifPath, 'utf8');
        this.sarifData = JSON.parse(fileContent);
        this.enabled = true;
      } catch (err) {
        console.warn(`⚠️ Failed to parse SARIF file at ${sarifPath}: ${err.message}`);
      }
    }
  }

  /**
   * Extracts relevant security findings for a specific file from the SARIF report.
   * @param {string} fileName The path of the modified file being reviewed
   * @returns {string} Formatted string of vulnerabilities to inject into the LLM prompt
   */
  getFindingsForFile(fileName) {
    if (!this.enabled || !this.sarifData || !this.sarifData.runs) {
      return '';
    }

    const fileFindings = [];

    for (const run of this.sarifData.runs) {
      if (!run.results) continue;
      
      for (const result of run.results) {
        // Look for locations matching our specific file
        const matchingLocation = result.locations?.find(loc => {
          const uri = loc.physicalLocation?.artifactLocation?.uri || '';
          // Ensure we match the end of the URI in case of relative/absolute path differences
          return uri.endsWith(fileName) || fileName.endsWith(uri);
        });

        if (matchingLocation) {
          const ruleId = result.ruleId || 'Unknown Rule';
          const message = result.message?.text || 'No description provided.';
          const startLine = matchingLocation.physicalLocation?.region?.startLine;
          
          fileFindings.push(
            `- [Line ${startLine || 'Unknown'}] Rule ${ruleId}: ${message}`
          );
        }
      }
    }

    if (fileFindings.length === 0) return '';

    return `\n\n<sast_baseline>\nThe static analysis security testing (SAST) tool has flagged the following potential vulnerabilities in this file:\n${fileFindings.join('\n')}\n\nPlease act as a Triage Engineer. Verify if these findings are true positives based on the context of the diff. If they are valid, explain the remediation clearly to the developer. If they are false positives, ignore them.\n</sast_baseline>\n`;
  }
}
