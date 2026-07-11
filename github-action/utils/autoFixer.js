// Utility to apply AI-generated auto-fixes directly as a commit on a branch
export async function applyFixes(octokit, owner, repo, branchRef, fixes) {
  if (!fixes || fixes.length === 0) return 0;
  
  try {
    // 1. Get the current commit of the branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: branchRef.replace(/^refs\//, '')
    });
    const headSha = refData.object.sha;

    // 2. Get the commit to find the base tree
    const { data: headCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: headSha
    });
    const baseTreeSha = headCommit.tree.sha;

    // Group fixes by file path
    const fixesByFile = {};
    for (const fix of fixes) {
      if (!fixesByFile[fix.path]) fixesByFile[fix.path] = [];
      fixesByFile[fix.path].push(fix);
    }

    const newTreeElements = [];

    // 3. Process each file
    for (const [filePath, fileFixes] of Object.entries(fixesByFile)) {
      try {
        // Fetch current file content
        const { data: fileData } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: headSha
        });
        
        if (fileData.type !== 'file' || !fileData.content) {
          console.warn(`Cannot auto-fix non-file or empty content at ${filePath}`);
          continue;
        }

        const buff = Buffer.from(fileData.content, 'base64');
        let contentLines = buff.toString('utf-8').split('\n');

        // Apply fixes (sort descending by line number to avoid shifting issues if replacing with multiple lines)
        fileFixes.sort((a, b) => b.line - a.line);
        for (const fix of fileFixes) {
          const index = fix.line - 1;
          if (index >= 0 && index < contentLines.length) {
            // Simple replacement for now. (Assumes 1-to-1 line replacement or insertion)
            // If the fix spans multiple lines, this naive implementation replaces a single line with multiple.
            contentLines[index] = fix.auto_fix_code;
          }
        }

        const newContent = contentLines.join('\n');

        // Create a new blob
        const { data: blobData } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: newContent,
          encoding: 'utf-8'
        });

        newTreeElements.push({
          path: filePath,
          mode: '100644', // normal file
          type: 'blob',
          sha: blobData.sha
        });
      } catch (err) {
        console.warn(`Failed to process auto-fix for file ${filePath}: ${err.message}`);
      }
    }

    if (newTreeElements.length === 0) return 0;

    // 4. Create new tree
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: newTreeElements
    });

    // 5. Create new commit
    const commitMessage = `🤖 fix: automatically applied ${fixes.length} trivial fixes by RepoSage AI\n\n- Resolves linting errors, typos, and minor syntax issues.`;
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [headSha]
    });

    // 6. Update the branch ref
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: branchRef.replace(/^refs\//, ''),
      sha: newCommit.sha,
      force: false
    });

    return newTreeElements.length;
  } catch (err) {
    console.error(`Auto-fix pipeline failed: ${err.message}`);
    return 0;
  }
}
