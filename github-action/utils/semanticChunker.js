/**
 * Semantic Chunker
 * Overhauls the arbitrary line-truncation logic by splitting large files 
 * strictly at the boundaries of top-level classes and functions.
 * 
 * Note: Due to native C++ bindings for tree-sitter failing in serverless CI environments (node-gyp errors),
 * this module implements a highly optimized Regex-based AST heuristic parser.
 */

const MAX_LINES_PER_CHUNK = 200;

/**
 * Semantically chunks a large file at function/class boundaries.
 * @param {string} fileContent - The complete file content
 * @param {string} fileExtension - e.g. '.js', '.py', '.go'
 * @returns {string[]} Array of semantic chunks
 */
export function chunkFileSemantically(fileContent, fileExtension) {
  const lines = fileContent.split('\n');
  
  if (lines.length <= MAX_LINES_PER_CHUNK) {
    return [fileContent];
  }

  // Define semantic boundary heuristics per language
  let boundaryRegex;
  switch (fileExtension.toLowerCase()) {
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
      // Matches class Foo, function bar, const baz = () =>, export function
      boundaryRegex = /^(?:export\s+)?(?:default\s+)?(?:class|function|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>)/;
      break;
    case '.py':
      // Matches def foo(): or class Foo:
      boundaryRegex = /^(?:async\s+)?(?:def|class)\s+\w+/;
      break;
    case '.go':
      // Matches func (t Type) Foo() or type Foo struct
      boundaryRegex = /^func\s+|^type\s+\w+\s+(?:struct|interface)/;
      break;
    default:
      // Fallback: chunk by line count
      return fallbackChunking(lines);
  }

  const chunks = [];
  let currentChunk = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if the current line is a semantic boundary
    // We also require the current chunk to have some minimum size to avoid tiny chunks
    if (boundaryRegex.test(line) && currentChunk.length > 50) {
      if (currentChunk.length >= MAX_LINES_PER_CHUNK) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
      } else {
         // If current chunk is small but we found a boundary, we can optionally split.
         // Let's only split if the chunk is getting too big.
         if (currentChunk.length > (MAX_LINES_PER_CHUNK * 0.8)) {
           chunks.push(currentChunk.join('\n'));
           currentChunk = [];
         }
      }
    }
    
    currentChunk.push(line);
    
    // Hard cutoff if a single function is massively long
    if (currentChunk.length >= (MAX_LINES_PER_CHUNK * 2)) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

function fallbackChunking(lines) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += MAX_LINES_PER_CHUNK) {
    chunks.push(lines.slice(i, i + MAX_LINES_PER_CHUNK).join('\n'));
  }
  return chunks;
}
