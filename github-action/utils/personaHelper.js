import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

export class PersonaHelper {
  /**
   * Loads the optional .ai-reviewer.yml configuration from the workspace root.
   * Generates a custom prompt string instructing the LLM on how to behave.
   * 
   * @param {string} workspaceRoot 
   * @returns {string} The persona prompt string
   */
  static getPersonaPrompt(workspaceRoot) {
    if (!workspaceRoot) {
      return this._getDefaultPersona();
    }

    const configPath = path.join(workspaceRoot, '.ai-reviewer.yml');
    
    if (!fs.existsSync(configPath)) {
      return this._getDefaultPersona();
    }

    try {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents);
      
      if (!config) {
        return this._getDefaultPersona();
      }

      return this._buildPromptFromConfig(config);
    } catch (err) {
      console.warn(`⚠️ Failed to parse .ai-reviewer.yml: ${err.message}. Falling back to default persona.`);
      return this._getDefaultPersona();
    }
  }

  static _getDefaultPersona() {
    return 'You are a Senior Staff Engineer performing an automated Pull Request code review.';
  }

  static _buildPromptFromConfig(config) {
    let promptParts = [];

    // Strictness
    if (config.strictness) {
      const s = config.strictness.toLowerCase();
      if (s === 'high') {
        promptParts.push('Apply a highly strict standard for code quality. Nitpick minor issues if necessary.');
      } else if (s === 'low') {
        promptParts.push('Apply a lenient standard. Only point out critical logical errors or security bugs. Ignore minor style issues.');
      }
    }

    // Tone
    if (config.tone) {
      const t = config.tone.toLowerCase();
      if (t === 'encouraging') {
        promptParts.push('Adopt an encouraging, junior-friendly, and polite tone. Compliment good code where appropriate.');
      } else if (t === 'strict') {
        promptParts.push('Adopt a direct, authoritative, and strictly professional tone.');
      } else if (t === 'educational') {
        promptParts.push('Adopt an educational tone. Take the time to explain the "why" behind your suggestions in detail.');
      }
    }

    // Focus
    if (Array.isArray(config.focus) && config.focus.length > 0) {
      const focusAreas = config.focus.join(', ');
      promptParts.push(`Focus your review specifically on the following areas: ${focusAreas}.`);
    }

    const basePrompt = this._getDefaultPersona();
    
    if (promptParts.length === 0) {
      return basePrompt;
    }

    return `${basePrompt}\n\nReview Guidelines:\n- ${promptParts.join('\n- ')}`;
  }
}
