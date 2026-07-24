import fs from 'fs';
import path from 'path';
import { DefaultArtifactClient } from '@actions/artifact';

/**
 * Aggregates and stores raw LLM request/response traces into GitHub Actions Artifacts
 * for compliance, auditing, and debugging.
 */
export class AuditLogger {
  constructor() {
    this.logs = [];
  }

  /**
   * Logs a single LLM request/response interaction.
   * Strips out massive background contexts (e.g. dependency tree text) to keep file sizes small.
   */
  addTrace({ filePath, model, maxTokens, prompt, response, tokensUsed, isDegraded }) {
    // Aggressively strip out background context if it exists to save artifact space
    let sanitizedPrompt = prompt;
    if (typeof sanitizedPrompt === 'string') {
      const bgIndex = sanitizedPrompt.indexOf('### Background Context');
      if (bgIndex !== -1) {
        sanitizedPrompt = sanitizedPrompt.substring(0, bgIndex) + '\n\n[...BACKGROUND CONTEXT STRIPPED FOR AUDIT LOG...]';
      }
    }

    this.logs.push({
      timestamp: new Date().toISOString(),
      filePath,
      model,
      maxTokens,
      isDegraded,
      prompt: sanitizedPrompt,
      response,
      tokensUsed: tokensUsed || 'unknown'
    });
  }

  /**
   * Saves the aggregated logs to a local file and uploads them to GitHub Artifacts with a 7-day retention.
   */
  async uploadArtifact() {
    if (this.logs.length === 0) {
      console.log('📝 No LLM queries to audit. Skipping artifact upload.');
      return;
    }

    const logFileName = 'reposage-audit-log.json';
    const logFilePath = path.join(process.cwd(), logFileName);

    try {
      // 1. Write to local file
      fs.writeFileSync(logFilePath, JSON.stringify(this.logs, null, 2));

      // 2. Skip upload if running in local CLI mode
      if (process.env.CLI_MODE === 'true') {
        console.log(`📝 Local CLI Mode: Audit log saved to ${logFilePath}. Skipping @actions/artifact upload.`);
        return;
      }

      // 3. Upload to GitHub Artifacts
      const artifactClient = new DefaultArtifactClient();
      const artifactName = `reposage-ai-audit-log-${Date.now()}`;
      
      console.log(`📝 Uploading AI Audit Log artifact: ${artifactName}...`);
      
      await artifactClient.uploadArtifact(
        artifactName,
        [logFilePath],
        process.cwd(),
        {
          retentionDays: 7 // Aggressive 7-day retention to save storage costs
        }
      );
      
      console.log('✅ Audit Log uploaded successfully.');
    } catch (err) {
      console.warn(`⚠️ Failed to generate or upload AI Audit Log: ${err.message}`);
    }
  }
}
