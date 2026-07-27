## 📝 Description

Implemented the **AI Code Reviewer Fine-Tuning Pipeline** via Telemetry tracking and Few-Shot Optimization. This allows the AI Engine to adapt over time and learn from the team's review resolution habits.

1. **Telemetry Webhook Listener**: Modified `backend/index.js` to listen for the `pull_request_review_thread` webhook with the `resolved` action. When a developer resolves an AI-generated thread, the code snippet and AI comment are logged into a persistent telemetry dataset (`backend/data/telemetry.jsonl`).
2. **Few-Shot Prompt Optimizer**: Created `ai-engine/scripts/fine_tune_optimizer.py`. This script reads the telemetry logs and extracts the highest-quality accepted comments to construct an optimized `few_shot_prompt.md`. The system prompt can ingest this to shape the AI's behavior and strictness dynamically based on real data.

Fixes #3135

## 🛠️ Type of Change

- [x] 🚀 New feature (non-breaking change which adds functionality)

## 🧪 How Has This Been Tested?

- [x] **Syntax Validation**: Verified that `index.js` compiles without errors and the `fine_tune_optimizer.py` script executes gracefully.
- [x] **Payload Interception logic**: Confirmed via tests that `pull_request_review_thread` filters specifically for bots before writing to the dataset.

## 📋 Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have linked the PR to a specific issue (e.g. `Fixes #12`)
- [x] (GSSoC Contributors) I have added the appropriate `gssoc26` label

---
⭐ **Support RepoSage!** If you find this project helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!
