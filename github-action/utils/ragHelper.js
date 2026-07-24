import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

export class RagHelper {
  constructor(pineconeApiKey, pineconeIndexName, openaiApiKey) {
    this.pineconeApiKey = pineconeApiKey;
    this.pineconeIndexName = pineconeIndexName;
    this.openaiApiKey = openaiApiKey;
    
    this.enabled = Boolean(this.pineconeApiKey && this.pineconeIndexName && this.openaiApiKey);
    
    if (this.enabled) {
      this.pinecone = new Pinecone({ apiKey: this.pineconeApiKey });
      this.openai = new OpenAI({ apiKey: this.openaiApiKey });
    }
  }

  /**
   * Generates embeddings for a given text using OpenAI
   */
  async generateEmbedding(text) {
    if (!this.enabled) return null;
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error(`⚠️ Failed to generate embedding: ${error.message}`);
      return null;
    }
  }

  /**
   * Queries the Pinecone index for relevant files based on the diff text
   */
  async queryRelevantFiles(diffText, topK = 3) {
    if (!this.enabled) return [];
    try {
      const embedding = await this.generateEmbedding(diffText);
      if (!embedding) return [];

      const index = this.pinecone.index(this.pineconeIndexName);
      
      const queryResponse = await index.query({
        vector: embedding,
        topK,
        includeMetadata: true
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        return [];
      }

      // Extract unique file paths and their semantic relevance from metadata
      return queryResponse.matches.map(match => ({
        path: match.metadata?.filePath || 'unknown_file',
        score: match.score,
        content: match.metadata?.content || '' // Assume content is stored in metadata
      }));
    } catch (error) {
      console.error(`⚠️ RAG Query failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Formats the RAG context string to append to the LLM prompt
   */
  async formatContextForPrompt(diffText) {
    const relevantFiles = await this.queryRelevantFiles(diffText);
    if (relevantFiles.length === 0) return '';

    let contextString = `\n\n--- REPOSITORY GLOBAL CONTEXT (RAG) ---\n`;
    contextString += `The following files in the repository are semantically related to the changes in this PR. Use this context to detect cross-file breaking changes or API misuse:\n\n`;
    
    for (const file of relevantFiles) {
      if (file.content) {
        contextString += `### File: ${file.path} (Relevance Score: ${file.score.toFixed(2)})\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      }
    }
    contextString += `--- END GLOBAL CONTEXT ---\n`;
    
    return contextString;
  }
}
