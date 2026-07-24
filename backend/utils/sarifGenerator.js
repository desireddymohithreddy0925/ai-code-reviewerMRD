/**
 * SarifGenerator: Converts AI Code Review findings into standard SARIF v2.1.0 format.
 * This allows native VS Code "Quick Fix" integration via GitHub Code Scanning.
 */

import crypto from 'crypto';

export class SarifGenerator {
  /**
   * Builds a valid SARIF JSON object from an array of AI comments.
   * @param {Array<{path: string, line: number, body: string}>} comments 
   * @returns {string} Stringified SARIF JSON payload
   */
  static buildSarif(comments) {
    const results = comments.map(comment => {
      // 1. Generate a stable fingerprint for GitHub Code Scanning
      const hash = crypto.createHash('sha256')
        .update(`${comment.path}:${comment.line}:${comment.body}`)
        .digest('hex');

      // 2. Check if the AI provided a code replacement block (VS Code Quick Fix)
      const suggestionMatch = comment.body.match(/```[a-z]*\n([\s\S]*?)```/);
      const replacementText = suggestionMatch ? suggestionMatch[1].trim() : null;

      // 3. Construct SARIF Result Node
      const result = {
        ruleId: "reposage-ai-finding",
        level: "warning",
        message: {
          text: this.stripCodeBlocks(comment.body)
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: comment.path
              },
              region: {
                startLine: Number(comment.line) || 1,
                endLine: Number(comment.line) || 1
              }
            }
          }
        ],
        partialFingerprints: {
          "primaryLocationLineHash": hash
        }
      };

      // 4. Inject Replacement snippet for VS Code lightbulb
      if (replacementText) {
        result.fixes = [
          {
            description: {
              text: "Apply AI Suggestion"
            },
            artifactChanges: [
              {
                artifactLocation: {
                  uri: comment.path
                },
                replacements: [
                  {
                    deletedRegion: {
                      startLine: Number(comment.line) || 1,
                      endLine: Number(comment.line) || 1
                    },
                    insertedContent: {
                      text: replacementText
                    }
                  }
                ]
              }
            ]
          }
        ];
      }

      return result;
    });

    // 5. Construct SARIF Envelope
    const sarifPayload = {
      version: "2.1.0",
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "RepoSage AI Code Reviewer",
              informationUri: "https://github.com/desireddymohithreddy0925/ai-code-reviewerMRD",
              rules: [
                {
                  id: "reposage-ai-finding",
                  name: "AI Code Suggestion",
                  shortDescription: {
                    text: "Code improvement suggested by LLM."
                  },
                  helpUri: "https://github.com/desireddymohithreddy0925/ai-code-reviewerMRD"
                }
              ]
            }
          },
          results: results
        }
      ]
    };

    return JSON.stringify(sarifPayload);
  }

  /**
   * Helper to strip markdown code blocks from the main message text,
   * since the code block will be handled natively by the IDE Replacement UI.
   */
  static stripCodeBlocks(text) {
    if (!text) return 'AI Suggestion';
    return text.replace(/```[\s\S]*?```/g, '<See VS Code Quick Fix for code suggestion>').trim();
  }
}
