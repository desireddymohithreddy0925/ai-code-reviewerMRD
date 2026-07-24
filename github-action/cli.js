#!/usr/bin/env node

/**
 * RepoSage Local CLI
 * Allows developers to run the AI Code Reviewer against their uncommitted changes
 * without needing to push to a GitHub PR.
 */

import { parseArgs } from 'node:util';
import { run } from './index.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// Load local .env for API keys
if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config();
}

const { values } = parseArgs({
  options: {
    'dry-run': {
      type: 'boolean',
      short: 'd',
    }
  },
  strict: false,
});

if (values['dry-run']) {
  console.log('🧪 Starting RepoSage Local Dry-Run Mode...');
  // Force index.js to bypass Octokit and output directly to stdout
  process.env.CLI_MODE = 'true';
}

if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error('\x1b[31m❌ Error: You must provide a GROQ_API_KEY or OPENAI_API_KEY in your .env file or environment variables to run the local CLI.\x1b[0m');
  process.exit(1);
}

// Run the core action logic!
run().catch(err => {
  console.error(`\x1b[31m❌ Fatal Error: ${err.message}\x1b[0m`);
  process.exit(1);
});
