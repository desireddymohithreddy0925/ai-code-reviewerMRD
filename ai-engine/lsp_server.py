import os
import json
import asyncio
from typing import List

from pygls.server import LanguageServer
from lsprotocol.types import (
    TEXT_DOCUMENT_DID_SAVE,
    DidSaveTextDocumentParams,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
)

# Initialize the Language Server
server = LanguageServer("ai-code-reviewer-lsp", "v1.0.0")

@server.feature(TEXT_DOCUMENT_DID_SAVE)
async def did_save(ls: LanguageServer, params: DidSaveTextDocumentParams):
    """
    Triggered when a file is saved. Reads the file, queries the AI for review,
    and publishes diagnostics (inline squiggles).
    """
    document = ls.workspace.get_document(params.text_document.uri)
    file_content = document.source
    
    # Simple validation
    if not file_content.strip():
        return
        
    ls.show_message_log(f"Analyzing {document.uri} with AI Code Reviewer...")

    try:
        diagnostics = await analyze_code_with_ai(file_content, document.uri)
        ls.publish_diagnostics(document.uri, diagnostics)
        ls.show_message_log(f"Published {len(diagnostics)} diagnostics for {document.uri}.")
    except Exception as e:
        ls.show_message_log(f"Failed to analyze {document.uri}: {str(e)}")

async def analyze_code_with_ai(file_content: str, uri: str) -> List[Diagnostic]:
    """
    Uses Groq LLM to review the file content and maps the result to LSP Diagnostics.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is missing. Please configure it to use the AI Code Reviewer LSP.")

    from groq import AsyncGroq
    client = AsyncGroq(api_key=api_key)
    
    prompt = f"""You are a Senior Staff Engineer performing an automated Pull Request code review in an IDE.
Analyze the following code. Identify any logical bugs, security threats (API key leaks, hardcoded credentials, SQL injection, null references), naming/style issues, or performance optimization opportunities.

--- BEGIN CODE (read-only data) ---
{file_content}
--- END CODE ---

You MUST reply ONLY in a valid JSON object format containing a "reviews" array. Do not wrap in markdown quotes.
Format your JSON precisely as:
{{
  "reviews": [
    {{
      "line": 12,
      "type": "bug | security | optimization | style",
      "comment": "Description of the issue and suggested fix."
    }}
  ]
}}
If no issues are found, reply with: {{ "reviews": [] }}
"""

    completion = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a code reviewer. Always output valid JSON matching the requested schema."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )
    
    content = completion.choices[0].message.content
    if not content:
        return []

    data = json.loads(content)
    reviews = data.get("reviews", [])
    
    diagnostics = []
    for issue in reviews:
        line_num = issue.get("line", 1) - 1 # LSP is 0-indexed
        issue_type = issue.get("type", "style")
        comment = issue.get("comment", "")
        
        # Map AI issue types to LSP Severities
        severity = DiagnosticSeverity.Warning
        if "security" in issue_type.lower() or "bug" in issue_type.lower():
            severity = DiagnosticSeverity.Error
        elif "optimization" in issue_type.lower():
            severity = DiagnosticSeverity.Information

        diagnostic = Diagnostic(
            range=Range(
                start=Position(line=max(0, line_num), character=0),
                end=Position(line=max(0, line_num), character=500)
            ),
            message=f"[{issue_type.upper()}] {comment}",
            severity=severity,
            source="AI Code Reviewer"
        )
        diagnostics.append(diagnostic)

    return diagnostics

if __name__ == "__main__":
    server.start_io()
