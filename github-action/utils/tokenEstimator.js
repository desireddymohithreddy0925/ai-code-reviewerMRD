/**
 * Lightweight heuristic token estimator and graceful degradation pipeline.
 * Avoids native bindings (tiktoken/node-gyp) to maintain CI cross-platform compatibility.
 */
export class TokenEstimator {
  /**
   * Estimates tokens based on average English/Code density (~3.5 chars per token).
   * @param {string} text 
   * @returns {number}
   */
  static estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Evaluates the context against the maxTokens limit and applies graceful degradation
   * if the limit is exceeded. Returns a safe context and a flag indicating if it was degraded.
   * 
   * @param {string} contextPrompt - The full string prompt to evaluate
   * @param {number} maxTokens - The absolute maximum tokens allowed
   * @returns {{ safeContext: string, isSummarizationOnly: boolean, tokens: number }}
   */
  static enforceGracefulDegradation(contextPrompt, maxTokens) {
    const safetyBuffer = Math.floor(maxTokens * 0.85); // 15% buffer
    let currentTokens = this.estimateTokens(contextPrompt);

    if (currentTokens <= safetyBuffer) {
      return { safeContext: contextPrompt, isSummarizationOnly: false, tokens: currentTokens };
    }

    console.warn(`⚠️ Token limit breached (${currentTokens} > ${safetyBuffer}). Initiating Phase 1 Degradation (Strip Markdown/Comments)...`);
    
    // Phase 1: Strip markdown codeblocks and inline code comments
    let degradedContext = contextPrompt
      .replace(/```[a-z]*\n/g, '') // Remove opening codeblocks
      .replace(/```/g, '') // Remove closing codeblocks
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments /* */
      .replace(/(?<!https?:)\/\/.*$/gm, ''); // Remove inline comments // (excluding http://)

    currentTokens = this.estimateTokens(degradedContext);
    if (currentTokens <= safetyBuffer) {
      return { safeContext: degradedContext, isSummarizationOnly: false, tokens: currentTokens };
    }

    console.warn(`⚠️ Token limit still breached (${currentTokens} > ${safetyBuffer}). Initiating Phase 2 Degradation (Strip Unmodified Lines)...`);

    // Phase 2: Strip unmodified context lines (lines starting with a space that aren't headers)
    degradedContext = degradedContext
      .split('\n')
      .filter(line => {
        // Keep additions (+), deletions (-), diff headers (@@), and basic structural text
        if (line.startsWith('+') || line.startsWith('-') || line.startsWith('@@') || !line.startsWith(' ')) {
          return true;
        }
        return false;
      })
      .join('\n');

    currentTokens = this.estimateTokens(degradedContext);
    if (currentTokens <= safetyBuffer) {
      return { safeContext: degradedContext, isSummarizationOnly: false, tokens: currentTokens };
    }

    console.warn(`⚠️ Token limit STILL breached (${currentTokens} > ${safetyBuffer}). Initiating Phase 3 Degradation (Summarization Mode)...`);

    // Phase 3: Absolute Fallback - Summarization Only
    // Completely replace the context prompt instruction
    const summaryInstruction = "CRITICAL LIMIT REACHED: The provided diff is too large for line-by-line review. Do NOT output a JSON array of specific line comments. Instead, provide a single 2-3 sentence high-level summary of what these changes attempt to accomplish, returning it as a single JSON object: { \"reviews\": [{ \"line\": 1, \"type\": \"Summary\", \"comment\": \"Your summary here...\" }] }.\n\n--- CHANGES ---\n" + degradedContext.substring(0, safetyBuffer * 3.5);

    return { 
      safeContext: summaryInstruction, 
      isSummarizationOnly: true, 
      tokens: this.estimateTokens(summaryInstruction) 
    };
  }
}
