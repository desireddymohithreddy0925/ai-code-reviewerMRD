/**
 * TicketFetcher: Integrates with Jira and Linear to fetch business requirements
 * and inject them into the LLM context.
 */

export class TicketFetcher {
  /**
   * Extracts a potential ticket ID (e.g. PROJ-123) from a PR branch name or title.
   * @param {string} text - The branch name or PR title
   * @returns {string|null} The matched ticket ID or null
   */
  static extractTicketId(text) {
    if (!text) return null;
    const match = text.match(/[A-Z]+-\d+/i);
    return match ? match[0].toUpperCase() : null;
  }

  /**
   * Fetches ticket details from Jira or Linear based on environment variables.
   * Gracefully degrades to null if API tokens are missing or requests fail.
   * 
   * @param {string} ticketId - e.g. PROJ-123
   * @returns {Promise<string|null>} Formatted Markdown business context or null
   */
  static async fetchTicketContext(ticketId) {
    if (!ticketId) return null;

    try {
      if (process.env.JIRA_API_TOKEN && process.env.JIRA_DOMAIN) {
        return await this.fetchFromJira(ticketId);
      } else if (process.env.LINEAR_API_KEY) {
        return await this.fetchFromLinear(ticketId);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch ticket context for ${ticketId}: ${err.message}`);
    }
    return null;
  }

  /**
   * Fetches a Jira Issue via REST API
   */
  static async fetchFromJira(ticketId) {
    const domain = process.env.JIRA_DOMAIN.replace(/\/$/, '');
    const url = `${domain}/rest/api/3/issue/${ticketId}`;
    
    // We assume JIRA_API_TOKEN is a Basic Auth token: base64(email:api_token)
    // Or just a Bearer token depending on setup. If basic, user should pass the encoded string.
    const token = process.env.JIRA_API_TOKEN;
    const authHeader = token.includes('Basic ') || token.includes('Bearer ') ? token : `Basic ${token}`;

    const res = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Jira API returned ${res.status}`);
    }

    const data = await res.json();
    const summary = data.fields?.summary || 'No Title';
    let description = '';

    // Jira API v3 uses Atlassian Document Format (ADF) for descriptions
    if (data.fields?.description?.content) {
      description = this.parseJiraADF(data.fields.description);
    } else if (typeof data.fields?.description === 'string') {
      description = data.fields.description;
    }

    return this.formatContext(ticketId, summary, description);
  }

  /**
   * Fetches a Linear Issue via GraphQL API
   */
  static async fetchFromLinear(ticketId) {
    const url = 'https://api.linear.app/graphql';
    const query = `
      query {
        issue(id: "${ticketId}") {
          title
          description
        }
      }
    `;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': process.env.LINEAR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!res.ok) {
      throw new Error(`Linear API returned ${res.status}`);
    }

    const data = await res.json();
    if (!data.data?.issue) {
      throw new Error(`Issue ${ticketId} not found in Linear`);
    }

    const summary = data.data.issue.title || 'No Title';
    const description = data.data.issue.description || '';

    return this.formatContext(ticketId, summary, description);
  }

  /**
   * Very rough parser for Jira Atlassian Document Format (ADF)
   */
  static parseJiraADF(doc) {
    let text = '';
    if (doc.type === 'text' && doc.text) {
      return doc.text;
    }
    if (doc.content && Array.isArray(doc.content)) {
      for (const node of doc.content) {
        text += this.parseJiraADF(node) + ' ';
      }
      text += '\n';
    }
    return text;
  }

  /**
   * Formats and truncates the context to prevent blowing out the LLM token budget.
   */
  static formatContext(ticketId, title, description) {
    // Truncate description to max 3000 chars to avoid token exhaustion
    const truncatedDesc = description.length > 3000 ? description.substring(0, 3000) + '\n...[TRUNCATED]' : description;
    
    return `### Business Requirements (Ticket ${ticketId})\n**Title**: ${title}\n\n**Description / Acceptance Criteria**:\n${truncatedDesc}\n\n---`;
  }
}
