import vm from 'vm';

/**
 * Extracts the suggested code block from a markdown comment.
 * @param {string} commentBody 
 * @returns {string|null} The suggested code, or null if no suggestion block exists.
 */
function extractSuggestionBlock(commentBody) {
  if (!commentBody) return null;
  const match = commentBody.match(/```suggestion\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
}

/**
 * Strips the suggestion block from the comment body and replaces it with a warning.
 * @param {string} commentBody 
 * @returns {string}
 */
function stripSuggestionBlock(commentBody, reason) {
  if (!commentBody) return commentBody;
  const warning = `\n\n> ⚠️ **RepoSage Warning:** An automated fix was suggested by the AI, but it was dropped because it failed local syntax verification (${reason}).`;
  return commentBody.replace(/```suggestion\n[\s\S]*?\n```/, warning);
}

/**
 * Verifies if the suggested code is syntactically valid in isolation or context.
 * Currently supports JS and TS syntax checking via Node's `vm` module.
 * 
 * @param {string} filePath 
 * @param {string} suggestedCode 
 * @returns {{valid: boolean, reason: string|null}}
 */
function verifySuggestionSyntax(filePath, suggestedCode) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  // We only run syntax checks on JS and TS files currently.
  // Other files bypass verification since we don't have native lightweight parsers for them.
  if (ext !== 'js' && ext !== 'ts' && ext !== 'jsx' && ext !== 'tsx') {
    return { valid: true, reason: null };
  }

  try {
    // Strip TypeScript specific syntax heuristically for basic validation, 
    // or just let VM try to parse it. VM will fail on strict TS types.
    // However, for basic JS syntax checking, vm.Script is perfect.
    
    // We wrap it in a function to allow return statements or isolated logic
    // We don't execute it, we only parse it!
    new vm.Script(`(function() { ${suggestedCode} \n})()`);
    return { valid: true, reason: null };
  } catch (error) {
    if (error instanceof SyntaxError) {
      // If it's TS, it might be a valid TS syntax error but invalid JS.
      // We will cautiously drop it to prevent breaking builds, 
      // or we can allow TS to bypass if we strictly want only JS checked.
      // For now, we'll flag any syntax error.
      return { valid: false, reason: 'SyntaxError: ' + error.message };
    }
    return { valid: false, reason: 'ParseError: ' + error.message };
  }
}

export {
  extractSuggestionBlock,
  stripSuggestionBlock,
  verifySuggestionSyntax
};
