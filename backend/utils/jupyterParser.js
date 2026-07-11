export function processJupyterDiff(fileChanges) {
  const extractedChanges = [];
  
  for (const change of fileChanges) {
    let content = change.content;
    
    // Check if the line looks like a JSON array string element from a Jupyter Notebook
    // e.g.   "import pandas as pd\n",
    // We match optional leading whitespace, a double quote, any content, a closing quote, optional comma, optional trailing whitespace.
    const match = content.match(/^\s*"(.*)"(,?)\s*$/);
    if (match) {
      try {
        // Unescape the JSON string (handles \" and \n correctly)
        // We use JSON.parse on a reconstructed string.
        let rawContent = JSON.parse(`"${match[1]}"`);
        
        // Jupyter strings usually end with a newline character, which we strip for the AI reviewer
        // so it looks like a standard code diff line without trailing literal \n.
        rawContent = rawContent.replace(/\n$/, '');
        
        extractedChanges.push({
          line: change.line, // Keep original JSON line number for direct GitHub PR mapping!
          content: rawContent
        });
        continue;
      } catch (e) {
        // Not a valid JSON string (maybe broken diff hunk), fallback to original content
      }
    }
    
    // If it's standard JSON metadata (e.g., "{", "outputs": [], etc.), keep it.
    // The AI is instructed to focus on the code.
    extractedChanges.push({
      line: change.line,
      content: content
    });
  }
  
  return extractedChanges;
}
