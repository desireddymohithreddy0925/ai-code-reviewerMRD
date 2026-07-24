import Groq from 'groq-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export class LlmRouter {
  constructor({ groqApiKey, fallbackProvider, fallbackModel, fallbackApiKey }) {
    this.groq = new Groq({ apiKey: groqApiKey });
    this.fallbackProvider = fallbackProvider?.toLowerCase();
    this.fallbackModel = fallbackModel;
    
    if (this.fallbackProvider === 'openai' && fallbackApiKey) {
      this.fallbackClient = new OpenAI({ apiKey: fallbackApiKey });
    } else if (this.fallbackProvider === 'anthropic' && fallbackApiKey) {
      this.fallbackClient = new Anthropic({ apiKey: fallbackApiKey });
    } else {
      this.fallbackClient = null;
    }
  }

  /**
   * Attempts to create a completion with Groq, falling back to the configured
   * provider on 429 or 5xx errors.
   */
  async createCompletion(messages, groqModel, maxTokens, temperature = 0.2) {
    try {
      // 1. Try Primary Provider (Groq)
      const response = await this.groq.chat.completions.create({
        model: groqModel,
        messages: messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });
      return response.choices[0].message.content;
    } catch (err) {
      const isRecoverableError = err.status === 429 || (err.status >= 500 && err.status < 600);
      
      if (!isRecoverableError || !this.fallbackClient || !this.fallbackModel) {
        console.error(`❌ Groq failed with non-recoverable error or no fallback configured: ${err.message}`);
        throw err;
      }

      console.warn(`⚠️ Groq API failed (${err.status}). Seamlessly routing to fallback provider: ${this.fallbackProvider}`);

      // 2. Try Fallback Provider
      return await this._routeToFallback(messages, maxTokens, temperature);
    }
  }

  async _routeToFallback(messages, maxTokens, temperature) {
    try {
      if (this.fallbackProvider === 'openai') {
        const response = await this.fallbackClient.chat.completions.create({
          model: this.fallbackModel,
          messages: messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        });
        return response.choices[0].message.content;
      } 
      
      if (this.fallbackProvider === 'anthropic') {
        // Anthropic system prompt extraction
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        const userMessages = messages.filter(m => m.role !== 'system');
        
        // Append a strict JSON instruction since Anthropic doesn't have a strict json_object response_format
        if (userMessages.length > 0) {
          userMessages[userMessages.length - 1].content += '\n\nYou MUST reply strictly with a valid JSON object matching the requested schema. No markdown wrapping or explanations.';
        }

        const response = await this.fallbackClient.messages.create({
          model: this.fallbackModel,
          system: systemMessage,
          messages: userMessages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: maxTokens,
          temperature,
        });
        
        return response.content[0].text;
      }
    } catch (fallbackErr) {
      console.error(`❌ Fallback provider ${this.fallbackProvider} also failed: ${fallbackErr.message}`);
      throw fallbackErr; // Bubble up if both fail
    }
  }
}
