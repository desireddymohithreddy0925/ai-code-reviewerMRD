const fs = require('fs');
const content = fs.readFileSync('backend/index.js', 'utf8');

const telemetryLogic = `
  if (event === 'pull_request_review_thread') {
    if (payload.action === 'resolved' && payload.thread && payload.thread.comments) {
      const comments = payload.thread.comments;
      if (comments.length > 0) {
        const firstComment = comments[0];
        const isBot = firstComment.user?.type === 'Bot' || firstComment.user?.login?.includes('reposage') || firstComment.user?.login?.includes('bot');
        if (isBot) {
          try {
            const path = require('path');
            const dataDir = path.join(process.cwd(), 'data');
            fs.mkdirSync(dataDir, { recursive: true });
            
            const telemetryFile = path.join(dataDir, 'telemetry.jsonl');
            const telemetryEntry = {
              timestamp: new Date().toISOString(),
              repo: payload.repository?.full_name,
              pull_number: payload.pull_request?.number,
              action: 'resolved',
              diff_hunk: firstComment.diff_hunk,
              path: firstComment.path,
              ai_comment: firstComment.body
            };
            
            fs.appendFileSync(telemetryFile, JSON.stringify(telemetryEntry) + '\\n');
            console.log(\`📈 Telemetry logged: AI review comment resolved on PR #\${payload.pull_request?.number}\`);
          } catch (e) {
            console.error('Failed to log telemetry:', e);
          }
        }
      }
    }
    return res.json({ message: "Processed pull_request_review_thread event" });
  }

  if (event === 'push') {`;

const newContent = content.replace("if (event === 'push') {", telemetryLogic);
fs.writeFileSync('backend/index.js', newContent, 'utf8');
