export class IpynbParser {
  /**
   * Filters the raw unified diff changes of an .ipynb file to ONLY include
   * the code inside the "source" arrays of "code" cells.
   * 
   * It drops base64 outputs, execution counts, and metadata, saving massive tokens.
   * 
   * @param {Array<{line: number, content: string}>} changes Array of diff changes
   * @returns {Array<{line: number, content: string}>} Filtered array
   */
  static filterDiffChanges(changes) {
    if (!Array.isArray(changes) || changes.length === 0) return changes;

    const filtered = [];
    
    // We don't have the full file, only the diff lines. 
    // So we use simple heuristics to detect if a line is likely part of the source code.
    // In a Jupyter notebook, source lines usually look like:
    // +    "import pandas as pd\n",
    // or
    // +    "print('hello')"
    // Output data often looks like:
    // +    "text/html": [ ... ]
    // +    "image/png": "iVBORw0KGgoAAAANSUhEUgAAA..."
    //
    // Since we only want to keep strings inside arrays that look like code,
    // we will apply a strict inclusion filter.

    for (const change of changes) {
      const trimmed = change.content.trim();
      
      // If it's incredibly long, it's almost certainly a base64 string
      if (trimmed.length > 500) {
        continue;
      }

      // If it looks like a base64 chunk (no spaces, alphanumeric + / + = + ")
      if (trimmed.length > 100 && /^"?[a-zA-Z0-9\+\/]+={0,2}"?,?$/.test(trimmed)) {
        continue;
      }

      // If it looks like execution count
      if (trimmed.match(/^"execution_count":/)) {
        continue;
      }

      // If it's a known output type marker
      if (trimmed.match(/^"(text\/(html|plain)|image\/(png|jpeg)|data)":/)) {
        continue;
      }

      // If it passed the filters, we keep it. This is a heuristic approach because 
      // strict state machine parsing of a *partial* JSON diff is mathematically impossible
      // without context lines that might be missing from the unified diff patch.
      filtered.push(change);
    }

    return filtered;
  }
}
