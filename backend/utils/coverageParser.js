import fs from 'fs';
import path from 'path';

/**
 * Parses LCOV format (lcov.info) coverage files.
 * Format reference:
 * SF:<absolute or relative path to source file>
 * DA:<line number>,<execution count>
 * end_of_record
 */
export class CoverageParser {
  /**
   * Reads an LCOV file and extracts lines with 0 execution count (uncovered lines).
   * @param {string} lcovPath - Path to the lcov.info file
   * @param {string} workspaceRoot - The GitHub workspace root
   * @returns {Object} Mapping of relative file paths to array of uncovered line numbers
   */
  static parseLcov(lcovPath, workspaceRoot = process.cwd()) {
    const coverageMap = {};
    if (!fs.existsSync(lcovPath)) {
      console.warn(`⚠️ Coverage file not found at path: ${lcovPath}`);
      return coverageMap;
    }

    try {
      const content = fs.readFileSync(lcovPath, 'utf8');
      const lines = content.split('\n');
      
      let currentFile = null;
      
      for (const line of lines) {
        if (line.startsWith('SF:')) {
          const rawPath = line.substring(3).trim();
          // Normalize to relative path
          if (path.isAbsolute(rawPath)) {
             currentFile = path.relative(workspaceRoot, rawPath);
          } else {
             currentFile = path.normalize(rawPath);
          }
          if (!coverageMap[currentFile]) {
             coverageMap[currentFile] = [];
          }
        } else if (line.startsWith('DA:') && currentFile) {
          const data = line.substring(3).trim().split(',');
          if (data.length >= 2) {
            const lineNum = parseInt(data[0], 10);
            const hits = parseInt(data[1], 10);
            if (hits === 0) {
              coverageMap[currentFile].push(lineNum);
            }
          }
        } else if (line === 'end_of_record') {
          currentFile = null;
        }
      }
    } catch (e) {
      console.error(`⚠️ Failed to parse LCOV file: ${e.message}`);
    }

    return coverageMap;
  }

  /**
   * Finds modified lines in a file diff that lack test coverage.
   * @param {Array<{line: number, content: string}>} fileChanges - Lines changed in the PR
   * @param {string} filePath - Relative file path
   * @param {Object} coverageMap - Parsed coverage map
   * @returns {Array<number>} Array of uncovered modified line numbers
   */
  static getUncoveredModifiedLines(fileChanges, filePath, coverageMap) {
    if (!coverageMap || !coverageMap[filePath]) {
      return [];
    }
    const uncoveredLines = coverageMap[filePath];
    // Find lines that are added/modified (starting with +) and lack coverage
    const modifiedLines = fileChanges
      .filter(c => c.content && c.content.startsWith('+'))
      .map(c => c.line);
    
    return modifiedLines.filter(line => uncoveredLines.includes(line));
  }
}
