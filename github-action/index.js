import { DependencyParser } from './utils/dependencyParser.js';
import { checkPromptInjection, wrapUntrustedDiff } from './utils/firewall.js';
import { buildDependencyGraphContext, findDanglingReferences } from './utils/dependencyGraph.js';
import { extractSuggestionBlock, stripSuggestionBlock, verifySuggestionSyntax } from './utils/sandboxVerifier.js';
import core from '@actions/core';
import github from '@actions/github';
import { parseDiff } from './utils/diffParser.js';
import { scanSecretsInChanges } from './utils/secretsScanner.js';
import { globToRegex } from './utils/globToRegex.js';
import { cleanAndParseJSON, normalizeReviewLineNumber } from './utils/actionUtils.js';
import { RagHelper } from './utils/ragHelper.js';
import { isPureFormatting } from './utils/astFilter.js';
import { LlmRouter } from './utils/llmRouter.js';
import { SemanticCache } from './utils/semanticCache.js';
import { ChunkHelper } from './utils/chunkHelper.js';
import { handleConversationEvent } from './utils/conversationHandler.js';
import { ImageFetcher } from './utils/imageFetcher.js';
import { PiiRedactor } from './utils/piiRedactor.js';
import { TokenEstimator } from './utils/tokenEstimator.js';
import { AuditLogger } from './utils/auditLogger.js';
import { TicketFetcher } from './utils/ticketFetcher.js';
import { SarifGenerator } from './utils/sarifGenerator.js';
import { RbacVerifier } from './utils/rbacVerifier.js';
import { DedupHelper } from './utils/dedupHelper.js';
import zlib from 'zlib';
import { CoverageParser } from './utils/coverageParser.js';
import { SarifParser } from './utils/sarifParser.js';
import { PersonaHelper } from './utils/personaHelper.js';
import { DiffMinifier } from './utils/diffMinifier.js';
import pLimit from 'p-limit';

const PARSE_FAILED = { reviews: [], _parseFailed: true };



import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const safetyConfigPath = resolve(__dirname, 'shared-safety-config.json');
const safetyConfig = JSON.parse(readFileSync(safetyConfigPath, 'utf8'));
const DANGEROUS_PHRASES = safetyConfig.dangerous_phrases;

function sanitizeDiffContent(content) {
  let sanitized = content;
  DANGEROUS_PHRASES.forEach((phrase, i) => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    sanitized = sanitized.replace(regex, `[SANITIZED_${i}]`);
  });
  return sanitized;
}

async function run() {
  try {
    // 1. Read Action Inputs
    const githubToken = core.getInput('github-token', { required: true });
    const groqApiKey = core.getInput('groq-api-key', { required: true });
    const pineconeApiKey = core.getInput('pinecone-api-key');
    const pineconeIndexName = core.getInput('pinecone-index-name');
    const openaiApiKey = core.getInput('openai-api-key');
    const fallbackProvider = core.getInput('fallback-provider');
    const fallbackModel = core.getInput('fallback-model');
    const fallbackApiKey = core.getInput('fallback-api-key');
    const redisUrl = core.getInput('redis-url');
    const sarifPath = core.getInput('sarif-path');
    const excludePathsInput = core.getInput('exclude-paths') || '';
    const includeExtensionsInput = core.getInput('include-extensions') || '';
    if (includeExtensionsInput) {
      const rawExtensions = includeExtensionsInput.split(',').map(e => e.trim()).filter(Boolean);
      for (const ext of rawExtensions) {
        if (!/^\.[a-zA-Z0-9]+$/.test(ext)) {
          core.setFailed(`Invalid file extension: "${ext}". Extensions must start with a dot and contain only alphanumeric characters (e.g., .js, .tsx).`);
          return;
        }
      }
    }
    const maxTokensInput = parseInt(core.getInput('max-tokens') || '4096', 10);
    const maxTokens = Number.isFinite(maxTokensInput) ? maxTokensInput : 4096;
    const autoApprove = core.getInput('auto-approve')?.toLowerCase() === 'true';

    const excludePatterns = excludePathsInput
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => globToRegex(p));

    const includeExtensions = includeExtensionsInput
      .split(',')
      .map(e => e.trim().toLowerCase().replace(/^\./, ''))
      .filter(e => e.length > 0);

    const defaultExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'cpp', 'h', 'cs', 'css', 'html', 'php', 'rb', 'sql', 'png', 'jpg', 'jpeg', 'webp', 'excalidraw'];
    const validExtensions = includeExtensions.length > 0 ? includeExtensions : defaultExtensions;

    // 2. Initialize Clients
    let provider;
    if (process.env.GITLAB_CI) {
      provider = new GitLabProvider(process.env.GITLAB_TOKEN || core.getInput('gitlab-token') || process.env.GITHUB_TOKEN);
    } else {
      provider = new GitHubProvider(githubToken);
    }
    provider.init();
    
    const octokit = github.getOctokit(githubToken);
    
    const llmRouter = new LlmRouter({ 
      groqApiKey, 
      fallbackProvider, 
      fallbackModel, 
      fallbackApiKey 
    });

    if (github.context.eventName === 'issue_comment' || github.context.eventName === 'pull_request_review_comment') {
      await handleConversationEvent(github.context, octokit, llmRouter);
      return;
    }
    
    const ragHelper = new RagHelper(pineconeApiKey, pineconeIndexName, openaiApiKey);
    if (ragHelper.enabled) {
      console.log('🌲 Pinecone RAG enabled for global repository context.');
    }
    
    const workspace = process.env.GITHUB_WORKSPACE || '';
    const dynamicPersona = PersonaHelper.getPersonaPrompt(workspace);
    console.log('🎭 Loaded AI Persona:', dynamicPersona);
    
    const sarifParser = new SarifParser(sarifPath);
    if (sarifParser.enabled) {
      console.log('🛡️ SARIF CodeQL Integration enabled.');
    }
    
    const coveragePath = core.getInput('coverage-path') || process.env.COVERAGE_PATH;
    let coverageMap = {};
    if (coveragePath) {
      console.log(`📊 Parsing LCOV coverage file at ${coveragePath}...`);
      coverageMap = CoverageParser.parseLcov(coveragePath, workspacePath);
    }
    
    const semanticCache = new SemanticCache(redisUrl);
    if (semanticCache.enabled) {
      console.log('⚡ Redis Semantic Caching enabled.');
    }

    // 3. Verify Context
    let owner = 'local', repo = 'local', pullNumber = 1;
    if (process.env.CLI_MODE !== 'true') {
      const ctx = provider.getContext();
      owner = ctx.owner;
      repo = ctx.repo;
      pullNumber = ctx.pullNumber;
      if (!pullNumber) {
        core.setFailed('❌ This script can only be run on pull_request or merge_request events.');
        return;
      }
    }

    console.log(`🚀 Starting RepoSage AI PR Review for PR #${pullNumber} in ${owner}/${repo}`);

    const headSha = github.context.payload.pull_request?.head?.sha;
    if (headSha) {
      try {
        const { data: ignoreFile } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: '.ai-ignore',
          ref: configRef
        });
        const ignoreContent = Buffer.from(ignoreFile.content, 'base64').toString('utf8');
        const ignoreLines = ignoreContent.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'));
        for (const pattern of ignoreLines) {
          excludePatterns.push(globToRegex(pattern));
        }
        console.log(`✅ Loaded ${ignoreLines.length} patterns from .ai-ignore`);
      } catch (e) {
        // file doesn't exist, ignore
      }
    }

    // 4. Fetch PR Diff
    let diff;
    if (process.env.CLI_MODE === 'true') {
      const { execSync } = require('child_process');
      try {
        diff = execSync('git diff HEAD', { encoding: 'utf-8' });
      } catch (e) {
        diff = '';
      }
    } else {
      diff = await provider.getDiff();
    }

    if (!diff) {
      core.warning('⚠️ No diff content found for this Pull Request.');
      return;
    }
    
    // Fetch existing PR review comments to avoid duplicates
    let existingComments = [];
    if (process.env.CLI_MODE !== 'true') {
      try {
        const response = await octokit.rest.pulls.listReviewComments({
          owner,
          repo,
          pull_number: pullNumber,
          per_page: 100
        });
        existingComments = response.data;
        console.log(`💬 Found ${existingComments.length} existing review comments.`);
      } catch (err) {
        console.warn(`⚠️ Could not fetch existing comments: ${err.message}`);
      }
    }

    // 5. Parse Diff
    const { files: parsedFiles } = parseDiff(diff);
    console.log(`📁 Found ${parsedFiles.length} files in PR diff.`);
    
    // 5.5 Dangling Reference Check
    const deletedFiles = [];
    const deletedExports = [];
    for (const f of parsedFiles) {
      if (f.deleted || (f.changes && f.changes.every(c => c.content.startsWith('-')) && f.changes.length > 0)) {
        deletedFiles.push(f.path);
      } else {
        for (const c of f.changes) {
          if (c.content.startsWith('-')) {
            const expMatch = c.content.match(/-\s*export\s+(?:const|let|var|function|class)\s+(\w+)/);
            if (expMatch) {
              deletedExports.push({ path: f.path, exportName: expMatch[1] });
            }
          }
        }
      }
    }
    
    if (deletedFiles.length > 0 || deletedExports.length > 0) {
      console.log(`🔍 Scanning for dangling imports across the workspace...`);
      const workspacePath = process.env.GITHUB_WORKSPACE || '.';
      const dangling = findDanglingReferences(deletedFiles, deletedExports, workspacePath);
      if (dangling.length > 0) {
        let danglingComment = `⚠️ **Static Analysis: Dangling References Detected!**\nThe following files are importing modules or exports that were deleted in this PR:\n`;
        for (const ref of dangling) {
           danglingComment += `- \`${ref.file}\` is missing \`${ref.brokenImport}\`\n`;
        }
        
        if (process.env.CLI_MODE === 'true') {
          console.log(`\n\x1b[33m[DRY RUN] ${danglingComment}\x1b[0m`);
        } else {
          try {
            await octokit.rest.issues.createComment({
              owner, repo, issue_number: pullNumber,
              body: danglingComment
            });
          } catch (e) {
            console.error("Failed to post dangling reference comment");
          }
        }
      }
    }


    const MAX_REVIEW_FILES = parseInt(core.getInput('max-review-files') || process.env.MAX_REVIEW_FILES || '50', 10);
    let totalReviewableFiles = 0;
    
    let packageContext = '';
    try {
      const workspacePath = process.env.GITHUB_WORKSPACE || '.';
      packageContext = DependencyParser.buildContext(workspacePath);
    } catch (err) {
      console.log(`ℹ️ Failed to parse dependencies: ${err.message}`);
    }

    const filesToProcess = [];
    let imageCounter = 0;
    for (const file of parsedFiles) {
      if (excludePatterns.some(regex => regex.test(file.path))) {
        console.log(`⏭️ Skipping excluded file: ${file.path}`);
        continue;
      }

      const fileName = file.path.split('/').pop() || file.path;
      const hasExt = fileName.includes('.');
      if (hasExt) {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (!validExtensions.includes(ext)) {
          console.log(`skip non-code file: ${file.path}`);
          continue;
        }
      }

      if (file.changes.length === 0) continue;

      const oldCodeChunk = (file.deletions || []).map(d => d.content).join('\n');
      const newCodeChunk = (file.changes || []).map(c => c.content).join('\n');
      
      const isFormattingOnly = await isPureFormatting(oldCodeChunk, newCodeChunk, fileName);
      if (isFormattingOnly) {
        console.log(`⏭️ Skipping purely formatting/whitespace changes for: ${file.path}`);
        continue;
      }

      totalReviewableFiles++;

      const changesText = file.changes
        .map(c => `Line ${c.line}: ${c.content}`)
        .join('\n');
        
      if (changesText.length > 20000 || file.changes.length > 300) {
        console.log(`⏭️ Skipping file too large for AI review: ${file.path} (${file.changes.length} changes, ${changesText.length} chars)`);
        continue;
      }

      filesToProcess.push({ file, changesText });
    }

    const diffTruncated = totalReviewableFiles > MAX_REVIEW_FILES;
    if (diffTruncated) {
      core.warning(`WARNING: PR diff has ${totalReviewableFiles} reviewable files, exceeding the review limit of ${MAX_REVIEW_FILES}. Only the first ${MAX_REVIEW_FILES} will be reviewed; the PR will NOT be auto-approved.`);
      filesToProcess.splice(MAX_REVIEW_FILES);
    }

    const commentsToPost = [];
    let reviewedFilesCount = 0;
    const auditLogger = new AuditLogger();
    let successfulReviewsCount = 0;
    let failedReviewsCount = 0;
    let emptyOrUnparseable = false;
    let incompleteSecretScan = false;
    let totalIssuesFound = 0;


    let currentBatchSize = 5;
    let i = 0;
    while (i < filesToProcess.length) {
      const batch = filesToProcess.slice(i, i + currentBatchSize);
      const batchComments = [];
      let rateLimitHit = false;
      let sleepMs = 0;
      let rateLimitTokens = null;

      await Promise.all(batch.map(async ({ file, changesText }) => {
        try {
          console.log(`🔍 Reviewing: ${file.path} (${file.changes.length} changes)`);
          
          // 1. Run local secrets scanner
          const { findings: localSecretIssues, truncated: scanTruncated, totalChanges: scanTotal, skippedReason: scanReason } = scanSecretsInChanges(file.changes);
          for (const issue of localSecretIssues) {
            const bodyText = `<!-- RepoSage Review Comment -->\n${issue.comment}`;
            const alreadyPostedOnPR = existingComments.some(c => c.path === file.path && c.line === issue.line && c.body === bodyText);
            if (!alreadyPostedOnPR) {
              batchComments.push({ path: file.path, line: issue.line, body: bodyText });
              commentsToPost.push({ path: file.path, line: issue.line, body: bodyText });
            }
          }
          if (scanTruncated) {
            incompleteSecretScan = true;
          }

          const sanitizedChangesText = sanitizeDiffContent(changesText);
          const ext = require('path').extname(file.path);
          const chunks = chunkFileSemantically(sanitizedChangesText, ext);
          
          for (let chunk of chunks) {
            // 1.4 PII Redaction
            chunk = PiiRedactor.redact(chunk);

            // 1.5 Firewall Check
            const firewall = checkPromptInjection(chunk, file.path);
            if (firewall.blocked) {
              console.warn(`⚠️ Firewall blocked review for ${file.path}: ${firewall.reason}`);
              batchComments.push({
                path: file.path,
                line: file.changes[0].line,
                body: `<!-- RepoSage Review Comment -->\n⚠️ **Security Alert**: RepoSage Firewall detected a potential prompt injection attempt in this file. Skipping automated review.`
              });
              break; // Skip LLM call for the rest of this file
            }
            
            const bgContext = buildDependencyGraphContext(file.path, process.cwd());
                        let coverageWarning = '';
            const uncoveredLines = CoverageParser.getUncoveredModifiedLines(file.changes, file.path, coverageMap);
            if (uncoveredLines.length > 0) {
               coverageWarning = `\n\nCRITICAL INSTRUCTION: The following modified lines lack test coverage: [${uncoveredLines.join(', ')}]. You MUST generate and output boilerplate Jest/PyTest/etc unit tests for these exact lines as part of your review. Do not just warn the user, give them the code to test it!`;
            }
            let contextPrompt = '';
            let userMessageContent;
            
            if (isImage) {
               contextPrompt = `Review the updated architecture diagram or UI mockup at ${file.path}. As a Senior Staff Engineer, identify any architectural flaws, UX issues, or missing components in this design. Note: This is a vision model task. Return your feedback as a JSON array of comments on line 1.`;
               userMessageContent = [
                 { type: 'text', text: contextPrompt },
                 { type: 'image_url', image_url: { url: `data:${imagePayload.mimeType};base64,${imagePayload.base64}` } }
               ];
            } else {
               contextPrompt = buildPrompt(file, chunk, existingComments, botUsername, packageContext, coverageWarning);
               userMessageContent = contextPrompt;
            }
            if (bgContext.length > 0) {
              contextPrompt += "\n\n### Background Context (Unmodified Dependencies)\n";
              bgContext.forEach(ctx => { contextPrompt += `\n--- ${ctx.path} ---\n${ctx.content}\n`; });
            }

            // Token Limit Degradation Check
            if (!isImage) {
               const degraded = TokenEstimator.enforceGracefulDegradation(contextPrompt, maxTokens);
               if (degraded.tokens > maxTokens) {
                 console.warn(`⚠️ Even after summarization mode, tokens (${degraded.tokens}) exceed limit (${maxTokens}). Truncating raw string...`);
                 contextPrompt = degraded.safeContext.substring(0, maxTokens * 3.5);
               } else {
                 contextPrompt = degraded.safeContext;
               }
               userMessageContent = contextPrompt;
            }

            const reviews = await llmRouter.createCompletion(
              [{ role: 'user', content: userMessageContent }],
              isImage ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile',
              maxTokens,
              0.2
            );
            
            auditLogger.addTrace({
              filePath: file.path,
              model: isImage ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile',
              maxTokens: maxTokens,
              prompt: userMessageContent,
              response: reviews,
              isDegraded: typeof degraded !== 'undefined' ? degraded.tokens > maxTokens : false
            });
            
            if (reviews._rateLimitRemaining !== undefined && reviews._rateLimitRemaining !== null) {
              rateLimitTokens = reviews._rateLimitRemaining;
            }

            const parsed = typeof reviews === 'string' ? JSON.parse(reviews) : reviews;
            if (parsed && Array.isArray(parsed.reviews)) {
              for (const issue of parsed.reviews) {
                const issueLine = parseInt(issue.line, 10);
                const validLine = file.changes.some(c => c.line === issueLine);
                
                if (validLine) {
                  const bodyText = `<!-- RepoSage Review Comment -->\n**${issue.type || 'Review'}**:\n${issue.comment}`;
                  const alreadyPostedOnPR = existingComments.some(c => c.path === file.path && c.line === issueLine && c.body === bodyText);
                  if (!alreadyPostedOnPR) {
                    batchComments.push({ path: file.path, line: issueLine, body: bodyText });
                    commentsToPost.push({ path: file.path, line: issueLine, body: bodyText });
                  }
                }
              }
            }
          }
        } catch (err) {
          if (err.status === 429) {
            rateLimitHit = true;
            let resetSec = parseInt(err.reset, 10);
            if (!isNaN(resetSec)) {
              sleepMs = Math.max(sleepMs, resetSec * 1000);
            } else if (err.retryAfter) {
              sleepMs = Math.max(sleepMs, parseInt(err.retryAfter, 10) * 1000);
            } else {
              sleepMs = Math.max(sleepMs, 5000);
            }
          } else {
            failedReviewsCount++;
            core.error(`❌ Groq review request failed for ${file.path}: ${err.message}`);
          }
        }
      }));

      if (rateLimitHit) {
        console.warn(`⚠️ Rate limit exceeded! Sleeping for ${sleepMs}ms...`);
        // Max 5 minutes sleep
        if (sleepMs > 300000) {
          console.warn("⚠️ Rate limit reset exceeds 5 minutes. Gracefully degrading and aborting further AI reviews to prevent CI timeout.");
          break;
        }
        await new Promise(r => setTimeout(r, sleepMs));
        currentBatchSize = 1; // backoff
        // Do not advance `i`, so we retry the batch
        continue;
      }
      
      if (rateLimitTokens !== null && rateLimitTokens < 10) {
         currentBatchSize = 1;
      } else if (currentBatchSize < 5) {
         currentBatchSize++;
      }

      totalIssuesFound += batchComments.length;
      if (batchComments.length > 0) {
        try {
          await octokit.rest.pulls.createReview({
            owner, repo, pull_number: pullNumber, event: 'COMMENT',
            body: `_RepoSage AI is processing this Pull Request... Found ${batchComments.length} issues in the current batch of files._`,
            comments: batchComments
          });
        } catch (err) {}
      }

      i += currentBatchSize;
    }
    // 6. Generate PR Summary
    try {
      let fullDiff = '';
      let imageCounter = 0;
    for (const file of parsedFiles) {
        if (file.changes.length > 0) {
          fullDiff += `\n--- a/${file.path}\n+++ b/${file.path}\n`;
          fullDiff += file.changes.map(c => c.content).join('\n');
        }
      }
      
      if (fullDiff.length > 0) {
        const truncatedDiff = fullDiff.length > 15000 ? fullDiff.substring(0, 15000) + '\n...[Diff truncated]' : fullDiff;
        
        const summaryPrompt = `You are a Senior Staff Engineer.
Generate a concise, high-level summary of the architectural and functional changes in this Pull Request based on the following diff.
Use a bulleted list. Limit to 3-5 concise bullet points. Avoid extremely minor details unless they are critical.

Diff:
\`\`\`
${truncatedDiff}
\`\`\`

Format your JSON precisely as:
{
  "summary": "- Added new feature X\\n- Refactored component Y"
}`;

        const summaryContent = await llmRouter.createCompletion(
          [
            { role: 'system', content: 'You are a code reviewer. Always output valid JSON matching the schema {"summary": "string"}.' },
            { role: 'user', content: summaryPrompt }
          ],
          'llama-3.3-70b-versatile',
          500,
          0.3
        );
        
        if (summaryContent) {
          const summaryData = JSON.parse(summaryContent);
          if (summaryData.summary) {
            const { data: pullRequest } = await octokit.rest.pulls.get({
              owner,
              repo,
              pull_number: pullNumber
            });
            
            let currentBody = pullRequest.body || '';
            const summaryStartTag = '<!-- RepoSage Summary -->';
            const summaryEndTag = '<!-- End RepoSage Summary -->';
            const newSummaryBlock = `${summaryStartTag}\n### 🤖 RepoSage PR Summary\n${summaryData.summary}\n${summaryEndTag}`;
            
            let newBody;
            const startIndex = currentBody.indexOf(summaryStartTag);
            const endIndex = currentBody.indexOf(summaryEndTag);
            
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
              newBody = currentBody.substring(0, startIndex) + newSummaryBlock + currentBody.substring(endIndex + summaryEndTag.length);
            } else {
              newBody = currentBody + (currentBody ? '\n\n' : '') + newSummaryBlock;
            }
            
            await octokit.rest.pulls.update({
              owner,
              repo,
              pull_number: pullNumber,
              body: newBody
            });
            console.log(`✅ Updated PR #${pullNumber} description with AI summary`);
          }
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed to generate or update PR summary:", err.message);
    }

    // 7. Post Consolidated Review
    if (totalIssuesFound > 0) {
      console.log(`✍️ Posting Final PR Review Summary...`);
      try {
        await octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: pullNumber,
          event: 'COMMENT',
          body: `## 🛡️ RepoSage AI Code Review Audit Completed!

🧐 **I have professionally reviewed and checked all your changes** to ensure they meet our project's high quality standards.

I have audited **${reviewedFilesCount} code files** in this Pull Request and generated **${totalIssuesFound} actionable inline suggestions** across multiple comments. 

${incompleteSecretScan ? 'Warning: One or more changed files exceeded the configured secret scan limits. Please split the PR or raise the scan limits and rerun before merging.\n\n' : ''}

Please review my feedback and suggestions below. Happy coding! 🚀

---
⭐ **Support RepoSage!** If you find this AI helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!`
        });
      } catch (err) {
        core.warning(`⚠️ Batched review creation failed (${err.message}); retrying comments individually and skipping invalid ones.`);
        for (const comment of commentsToPost) {
          try {
            await provider.createReview({
              event: 'COMMENT',
              body: 'RepoSage AI Code Review Audit (individual comment retry)',
              comments: [comment]
            });
          } catch (commentErr) {
            core.warning(`⚠️ Skipping invalid inline comment on ${comment.path}:${comment.line} — ${commentErr.message}`);
          }
        }
      }

    } else if (incompleteSecretScan) {
      console.log('Secret scan was incomplete. Posting warning review instead of approving.');
      await provider.createReview({
        event: 'COMMENT',
        body: `## RepoSage Secret Scan Incomplete\n\nThe local secret scanner stopped before processing all changed lines. No approval was posted because hardcoded credentials may exist in the unscanned portion of this Pull Request.\n\nPlease split the PR or raise the configured scan limits and rerun the review.`
      });
    } else if (reviewedFilesCount > 0 && successfulReviewsCount > 0) {
      console.log('🎉 No code issues or recommendations found in successful reviews. Posting review status...');

      const canApprove = autoApprove && failedReviewsCount === 0 && !diffTruncated && !emptyOrUnparseable;
      const reviewEvent = canApprove ? 'APPROVE' : 'COMMENT';
      const truncationWarning = diffTruncated
        ? `\n\nWARNING: **Partial Review:** This PR exceeded the review limit of ${MAX_REVIEW_FILES} files (${totalReviewableFiles} reviewable). The remaining files were **not** analyzed, so this is **not** a full approval of all changes. Please review them manually or split the PR.`
        : '';
      const issuesText = reviewEvent === 'APPROVE'
        ? `🎉 Outstanding work! I have scanned the PR and found **0 issues**. Approved! 🚀`
        : `✅ Review complete. Found 0 issues.`;
        
      await provider.createReview({
        event: reviewEvent,
        body: `## 🛡️ RepoSage AI Code Review Audit Completed!

🧐 **I have professionally reviewed and checked all your changes** to ensure they meet our project's high quality standards.

${issuesText}${truncationWarning}

---
⭐ **Support RepoSage!** If you find this AI helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!`
      });

      if (autoApprove && failedReviewsCount === 0 && !diffTruncated && !emptyOrUnparseable) {
        try {
          await provider.addLabel('gssoc:approved');
          console.log('✅ Added gssoc:approved label to PR');
        } catch (err) {
          console.warn('⚠️ Could not add gssoc:approved label:', err.message);
        }
      }
    }

    if (failedReviewsCount > 0) {
      core.setFailed(
        `Review incomplete: ${successfulReviewsCount} file review(s) succeeded and ${failedReviewsCount} failed.`
      );
      return;
    }

    console.log('✅ RepoSage AI Pull Request Review completed successfully.');

  } catch (err) {
    core.setFailed(`❌ Action run failed: ${err.message}`);
  } finally {
    if (typeof semanticCache !== 'undefined') {
      await semanticCache.quit();
    }
  }
}

if (process.env.CLI_MODE !== 'true') {
  run();
}
export { run };
