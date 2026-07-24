/**
 * Heuristic detector for N+1 database querying issues (queries inside loops).
 * This uses regex to find looping structures that contain ORM query calls.
 */
export class NPlusOneDetector {
  /**
   * Detects if the provided code string likely contains an N+1 query issue.
   * @param {string} code 
   * @returns {boolean}
   */
  static detect(code) {
    if (!code) return false;

    // 1. Identify common loop structures in multiple languages
    // e.g. "for (", "while (", ".map(", ".forEach(", "for " (Python), "while " (Python)
    const loopRegex = /(?:for\s*\(|while\s*\(|\.map\s*\(|\.forEach\s*\(|for\s+\w+\s+in\s+|while\s+)/;

    // 2. Identify common ORM query patterns
    // Prisma: prisma.user.findMany, typeorm: repository.findOne, mongoose: Model.find
    // SQLAlchemy: session.query, Django: Model.objects.filter
    const queryRegex = /(?:\.find(?:One|Many|All|ByPk)?\(|\.query\(|\.execute\(|\.objects\.(?:filter|get|all)\(|session\.query\()/;

    // Fast reject if neither exist anywhere in the code
    if (!loopRegex.test(code) || !queryRegex.test(code)) {
      return false;
    }

    // Heuristic: If we see a loop and a query within a reasonably small window of lines,
    // it's highly likely to be a query inside a loop (or at least warrants LLM review).
    // We'll chunk the code by braces/indentation or just look for proximity.
    
    const lines = code.split('\n');
    let insideLoop = false;
    let loopNesting = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Keep track of brackets for C-style languages
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      if (loopRegex.test(line)) {
        insideLoop = true;
        // If it has a brace, we rely on braces. Otherwise, proximity (e.g. Python).
        if (openBraces > 0) {
          loopNesting += openBraces - closeBraces;
        } else {
          // For languages without braces, just assume a 10-line window
          loopNesting = 1;
        }
      } else if (insideLoop) {
        loopNesting += openBraces - closeBraces;
        
        if (queryRegex.test(line)) {
          return true; // Query found inside an active loop tracking window
        }
        
        if (loopNesting <= 0) {
          insideLoop = false;
          loopNesting = 0;
        }
      }
    }

    // Python-style indentation fallback
    // Only run if the file seems to lack standard C-style braces
    if (!code.includes('{') && !code.includes('}')) {
      let activeIndent = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const indent = line.search(/\S/);
        
        if (loopRegex.test(line)) {
          activeIndent = indent;
        } else if (activeIndent !== -1) {
          if (indent > activeIndent) {
             if (queryRegex.test(line)) return true;
          } else {
             activeIndent = -1; // Exited loop block
          }
        }
      }
    }

    return false;
  }
}
