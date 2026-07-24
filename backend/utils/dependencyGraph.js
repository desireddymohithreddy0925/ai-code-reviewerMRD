import fs from 'fs';
import path from 'path';

const MAX_DEPENDENCY_FILES = 3;
const MAX_LINES_PER_FILE = 300; // rough approximation to stay under 1000 lines total

/**
 * Very lightweight AST/regex dependency resolution.
 * Finds related files (imports) in the same directory or project root.
 * 
 * @param {string} filePath - Absolute path to the modified file
 * @param {string} repoRoot - Absolute path to the repository root
 * @returns {Array<{path: string, content: string}>} - Array of dependent file objects
 */
export function buildDependencyGraphContext(filePath, repoRoot) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  
  const dependencies = new Set();
  
  // Basic Regex for JS/TS
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    const importRegex = /from\s+['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      dependencies.add(match[1]);
    }
    const requireRegex = /require\(['"](\.[^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(fileContent)) !== null) {
      dependencies.add(match[1]);
    }
  }

  // Basic Regex for Python
  if (ext === '.py') {
    const importRegex = /^from\s+([a-zA-Z0-9_.]+)\s+import/gm;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      // Convert python package path to relative path
      const pyPath = './' + match[1].replace(/\./g, '/');
      dependencies.add(pyPath);
    }
  }

  const contextFiles = [];
  const currentDir = path.dirname(filePath);

  for (const dep of dependencies) {
    if (contextFiles.length >= MAX_DEPENDENCY_FILES) {
      break;
    }

    // Try resolving as exact path or with common extensions
    const possibleExts = ext === '.py' ? ['.py'] : ['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
    
    for (const pExt of possibleExts) {
      const resolvedPath = path.resolve(currentDir, dep.endsWith(pExt) || dep.includes('/index.') ? dep : dep + pExt);
      
      // Ensure it doesn't escape repoRoot and exists
      if (resolvedPath.startsWith(repoRoot) && fs.existsSync(resolvedPath)) {
        // Prevent loading huge files
        const stats = fs.statSync(resolvedPath);
        if (stats.size > 50000) continue; // Skip files > 50kb
        
        let content = fs.readFileSync(resolvedPath, 'utf-8');
        const lines = content.split('\n');
        
        if (lines.length > MAX_LINES_PER_FILE) {
          content = lines.slice(0, MAX_LINES_PER_FILE).join('\n') + '\n...[truncated]';
        }

        // Relative path for the LLM
        const relPath = path.relative(repoRoot, resolvedPath);
        
        contextFiles.push({
          path: relPath,
          content: content
        });
        break; // Stop checking extensions for this dependency
      }
    }
  }

  return contextFiles;
}

/**
 * Fast recursive file scanner ignoring common massive directories.
 */
function walkDirSync(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build' || file === 'vendor') {
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDirSync(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.js', '.jsx', '.ts', '.tsx', '.py', '.go'].includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

/**
 * Detects dangling references caused by deleted files or deleted exports.
 * @param {Array<string>} deletedFiles - Array of deleted relative file paths
 * @param {Array<{path: string, exportName: string}>} deletedExports - Array of deleted specific exports
 * @param {string} repoRoot - Repository root
 * @returns {Array<{file: string, brokenImport: string, type: string}>} - Array of dangling references
 */
export function findDanglingReferences(deletedFiles, deletedExports = [], repoRoot = process.cwd()) {
  const dangling = [];
  if (deletedFiles.length === 0 && deletedExports.length === 0) {
    return dangling;
  }

  const allFiles = walkDirSync(repoRoot);

  for (const filePath of allFiles) {
    const relFilePath = path.relative(repoRoot, filePath);
    // If the file itself is deleted, it doesn't matter if it has broken imports
    if (deletedFiles.includes(relFilePath)) continue;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      // 1. Check for deleted files being imported
      for (const delFile of deletedFiles) {
        const basename = path.basename(delFile, path.extname(delFile));
        // Check if there is an import statement that contains the basename
        const importRegex = new RegExp(`from\\s+['"]([\\.\\/\\w]+${basename})['"]`, 'g');
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          dangling.push({ file: relFilePath, brokenImport: match[1], type: 'file_deletion' });
        }
      }

      // 2. Check for deleted exports being imported
      for (const delExport of deletedExports) {
         // Example: import { foo } from './utils'
         const exportRegex = new RegExp(`import\\s+\\{[^\\}]*\\b${delExport.exportName}\\b[^\\}]*\\}\\s+from`, 'g');
         if (exportRegex.test(content)) {
           dangling.push({ file: relFilePath, brokenImport: delExport.exportName, type: 'export_deletion' });
         }
      }
    }
  }

  return dangling;
}
