import core from '@actions/core';

export async function handleConversationEvent(context, octokit, llmRouter) {
  const { eventName, payload } = context;
  const botUsername = 'ai-code-reviewer'; // Or extract from context if using a specific app

  let commentBody = '';
  let commentId = null;
  let prNumber = null;
  let isReviewComment = false;

  if (eventName === 'issue_comment' && payload.issue?.pull_request) {
    commentBody = payload.comment.body;
    commentId = payload.comment.id;
    prNumber = payload.issue.number;
  } else if (eventName === 'pull_request_review_comment') {
    commentBody = payload.comment.body;
    commentId = payload.comment.id;
    prNumber = payload.pull_request.number;
    isReviewComment = true;
  } else {
    console.log('⏭️ Not a supported comment event for conversational review.');
    return;
  }

  // Check if the bot was mentioned
  if (!commentBody.includes(`@${botUsername}`) && !commentBody.includes('/ask')) {
    console.log('⏭️ Bot not mentioned in the comment. Ignoring.');
    return;
  }

  console.log(`💬 Conversational Review triggered on PR #${prNumber}`);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  try {
    let conversationHistory = [];
    let codeContext = '';

    if (isReviewComment) {
      // It's a comment on a specific line of code. Fetch the thread.
      const thread = await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
      });
      
      // Filter the thread to the specific discussion
      const currentComment = thread.data.find(c => c.id === commentId);
      if (currentComment) {
        const inReplyToId = currentComment.in_reply_to_id || currentComment.id;
        const threadComments = thread.data.filter(c => c.id === inReplyToId || c.in_reply_to_id === inReplyToId);
        
        // Sort chronologically
        threadComments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        codeContext = currentComment.diff_hunk || 'No diff context available.';
        
        for (const c of threadComments) {
          const role = c.user.login.includes(botUsername) ? 'assistant' : 'user';
          conversationHistory.push({ role, content: c.body });
        }
      }
    } else {
      // It's a general issue comment, just grab the latest comment
      conversationHistory.push({ role: 'user', content: commentBody });
    }

    const systemPrompt = `You are an AI Code Review Assistant. You are having a conversation with a developer on a Pull Request.
    
Context (if applicable):
\`\`\`
${codeContext}
\`\`\`

Answer the user's questions clearly, concisely, and provide code examples if asked. Return your response as a valid JSON object matching the schema: {"reply": "Your markdown response"}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory
    ];

    const content = await llmRouter.createCompletion(
      messages,
      'llama-3.3-70b-versatile',
      1000,
      0.3
    );

    let parsedReply = 'Sorry, I failed to generate a response.';
    if (content) {
      try {
        const parsed = JSON.parse(content);
        parsedReply = parsed.reply || content;
      } catch (e) {
        parsedReply = content; // Fallback to raw content if JSON fails
      }
    }

    // Post the reply back to GitHub
    if (isReviewComment) {
      await octokit.rest.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        comment_id: commentId,
        body: parsedReply
      });
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: parsedReply
      });
    }
    
    console.log('✅ Successfully replied to the conversational prompt.');

  } catch (err) {
    core.error(`❌ Failed to process conversational review: ${err.message}`);
  }
}
