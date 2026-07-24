/**
 * ComplexityAnalyzer: Polyglot heuristic estimator for Cyclomatic Complexity 
 * and Halstead Effort metrics based on Regex.
 */

export class ComplexityAnalyzer {
  /**
   * Estimates Cyclomatic Complexity (CC) by counting branching keywords.
   * Base CC is 1. We add 1 for every branching keyword found.
   */
  static estimateCyclomatic(code) {
    if (!code) return 1;
    let cc = 1;
    
    // Universal branching keywords across most C-style and script languages
    const branches = (code.match(/\b(if|else if|for|while|case|catch|foreach)\b/g) || []).length;
    // Operators that introduce branching
    const operators = (code.match(/(&&|\|\||\?)/g) || []).length;
    
    cc += branches + operators;
    return cc;
  }

  /**
   * Rough Halstead Effort heuristic based on operator/operand counting approximations.
   */
  static estimateHalstead(code) {
    if (!code) return 0;
    
    // Operators (math, logic, assignment)
    const n1 = new Set(code.match(/(\+|-|\*|\/|=|==|!=|>|<|>=|<=|&&|\|\||!)/g) || []).size;
    const N1 = (code.match(/(\+|-|\*|\/|=|==|!=|>|<|>=|<=|&&|\|\||!)/g) || []).length;
    
    // Operands (variables, words, numbers)
    const operandsMatch = code.match(/\b([a-zA-Z_]\w*|\d+)\b/g) || [];
    const n2 = new Set(operandsMatch).size;
    const N2 = operandsMatch.length;
    
    if (n1 === 0 || n2 === 0) return 0;
    
    // Volume = (N1 + N2) * log2(n1 + n2)
    const volume = (N1 + N2) * Math.log2(n1 + n2);
    // Difficulty = (n1 / 2) * (N2 / n2)
    const difficulty = (n1 / 2) * (N2 / n2);
    // Effort = Volume * Difficulty
    return Math.round(volume * difficulty);
  }

  /**
   * Analyzes a PR file diff to calculate the net complexity delta.
   * We estimate the 'old' file and 'new' file by looking at additions/deletions.
   */
  static analyzeDiff(parsedFiles) {
    const results = [];
    let totalCcDelta = 0;
    let totalEffortDelta = 0;

    for (const file of parsedFiles) {
      if (!file.changes || file.changes.length === 0) continue;
      
      // Reconstruct old and new content strictly from the diff chunks
      let oldCode = '';
      let newCode = '';
      
      file.changes.forEach(c => {
        if (c.type === 'del') oldCode += c.content + '\n';
        else if (c.type === 'add') newCode += c.content + '\n';
        else {
          oldCode += c.content + '\n';
          newCode += c.content + '\n';
        }
      });
      
      const oldCc = this.estimateCyclomatic(oldCode);
      const newCc = this.estimateCyclomatic(newCode);
      const ccDelta = newCc - oldCc;
      
      const oldEff = this.estimateHalstead(oldCode);
      const newEff = this.estimateHalstead(newCode);
      const effortDelta = newEff - oldEff;
      
      if (ccDelta !== 0 || effortDelta !== 0) {
        results.push({
          path: file.path,
          ccDelta,
          effortDelta,
          newCc
        });
        totalCcDelta += ccDelta;
        totalEffortDelta += effortDelta;
      }
    }

    // Sort by largest absolute CC delta
    results.sort((a, b) => Math.abs(b.ccDelta) - Math.abs(a.ccDelta));

    return {
      totalCcDelta,
      totalEffortDelta,
      topFiles: results.slice(0, 5)
    };
  }

  /**
   * Generates a Markdown table for the PR Summary.
   */
  static generateMarkdownTable(analysisData) {
    if (analysisData.topFiles.length === 0) return '';
    
    let md = `\n### 📊 Code Complexity Impact\n\n`;
    md += `*Overall Technical Debt Trend:* **${analysisData.totalCcDelta > 0 ? '📈 Increased' : '📉 Decreased'}** (Cyclomatic Delta: \`${analysisData.totalCcDelta > 0 ? '+' : ''}${analysisData.totalCcDelta}\`, Halstead Effort: \`${analysisData.totalEffortDelta > 0 ? '+' : ''}${analysisData.totalEffortDelta}\`)\n\n`;
    
    md += `| File | CC Delta | Halstead Delta |\n`;
    md += `|---|---|---|\n`;
    
    analysisData.topFiles.forEach(f => {
      const ccStr = f.ccDelta > 0 ? `+${f.ccDelta} 🔴` : `${f.ccDelta} 🟢`;
      const effStr = f.effortDelta > 0 ? `+${f.effortDelta}` : `${f.effortDelta}`;
      md += `| \`${f.path}\` | ${ccStr} | ${effStr} |\n`;
    });
    
    return md;
  }
}
import path from 'path';

// 🟢 Helper to analyze static complexity of source files
export function analyzeComplexity(fileContent, filePath) {
  if (!fileContent || typeof fileContent !== 'string') {
    return {
      totalLines: 0,
      emptyLines: 0,
      commentLines: 0,
      codeLines: 0,
      functionCount: 0,
      complexityScore: 0,
      grade: 'A'
    };
  }

  const lines = fileContent.split('\n');
  const totalLines = lines.length;
  let emptyLines = 0;
  let commentLines = 0;
  let functionCount = 0;

  const ext = path.extname(filePath || '').toLowerCase();

  // Languages that use C-style block comments /* ... */
  const cStyleExts = ['.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.h', '.cs', '.go', '.rs', '.php', '.css'];
  const usesCStyleBlocks = cStyleExts.includes(ext);
  const usesHtmlBlocks = (ext === '.html');
  let inBlockComment = false;
  let inPyBlockComment = false;
  let pyBlockQuoteChar = null;

  lines.forEach(line => {
    const trimmed = line.trim();

    // Empty line detection
    if (trimmed === '') {
      emptyLines++;
      return;
    }

    // --- Comment Detection with multi-line block tracking ---

    if (usesCStyleBlocks) {
      // Currently inside a /* ... */ block comment
      if (inBlockComment) {
        commentLines++;
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        return;
      }

      // Single-line comment: //
      if (trimmed.startsWith('//')) {
        commentLines++;
        return;
      }
      // Single-line block comment: /* ... */ on same line
      else if (trimmed.startsWith('/*') && trimmed.includes('*/')) {
        commentLines++;
        return;
      }
      // Multi-line block comment opening: /*
      else if (trimmed.startsWith('/*')) {
        commentLines++;
        inBlockComment = true;
        return;
      }
    } else if (ext === '.py' || ext === '.rb') {
      if (ext === '.py') {
        if (inPyBlockComment) {
          commentLines++;
          if (trimmed.includes(pyBlockQuoteChar)) {
            inPyBlockComment = false;
            pyBlockQuoteChar = null;
          }
          return;
        }
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
          commentLines++;
          const quoteChar = trimmed.startsWith('"""') ? '"""' : "'''";
          if (trimmed.slice(3).includes(quoteChar)) {
            // Closed on same line
          } else {
            inPyBlockComment = true;
            pyBlockQuoteChar = quoteChar;
          }
          return;
        }
      }
      if (trimmed.startsWith('#')) {
        commentLines++;
        return;
      }
    } else if (ext === '.sql') {
      if (inBlockComment) {
        commentLines++;
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        return;
      }
      if (trimmed.startsWith('--')) {
        commentLines++;
        return;
      } else if (trimmed.startsWith('/*') && trimmed.includes('*/')) {
        commentLines++;
        return;
      } else if (trimmed.startsWith('/*')) {
        commentLines++;
        inBlockComment = true;
        return;
      }
    } else if (usesHtmlBlocks) {
      if (inBlockComment) {
        commentLines++;
        if (trimmed.includes('-->')) {
          inBlockComment = false;
        }
        return;
      }
      if (trimmed.startsWith('<!--')) {
        commentLines++;
        if (trimmed.includes('-->')) {
          return;
        }
        inBlockComment = true;
      }
    }

    // --- Function Detection ---
    let codeWithoutStrings = trimmed;
    codeWithoutStrings = codeWithoutStrings
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
      .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")
      .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, "``");

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      if (codeWithoutStrings.includes('function ') || codeWithoutStrings.includes('=>') || /^\s*(?:async\s+)?(?!(?:if|for|while|switch|catch)\b)\w+\s*\([^)]*\)\s*\{/.test(codeWithoutStrings)) {
        functionCount++;
      }
    } else if (ext === '.py') {
      if (codeWithoutStrings.startsWith('def ') || codeWithoutStrings.startsWith('async def ')) {
        functionCount++;
      }
    } else if (ext === '.go') {
      if (codeWithoutStrings.startsWith('func ')) {
        functionCount++;
      }
    } else if (['.java', '.cpp', '.cs'].includes(ext)) {
      if (/(?:public|private|protected|static|(?!(?:if|else|for|while|switch|catch)\b)\w+)\s+(?!(?:if|else|for|while|switch|catch)\b)\w+\s*\([^)]*\)\s*(?:\{|const)?/.test(codeWithoutStrings)) {
        functionCount++;
      }
    }
  });

  const codeLines = totalLines - emptyLines - commentLines;
  const complexityScore = Math.round((totalLines / 25) + (functionCount * 3));
  let grade = 'A';
  if (complexityScore > 40) grade = 'F';
  else if (complexityScore > 25) grade = 'D';
  else if (complexityScore > 15) grade = 'C';
  else if (complexityScore > 8) grade = 'B';

  return {
    totalLines,
    emptyLines,
    commentLines,
    codeLines,
    functionCount,
    complexityScore,
    grade
  };
}
