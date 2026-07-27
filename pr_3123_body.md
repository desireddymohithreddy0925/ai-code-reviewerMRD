## 📝 Description

Implemented the **Developer Persona Configuration (Adaptive Strictness)** feature. Added support for a `.ai-reviewer-personas.yml` file which allows mapping GitHub handles to specific experience levels or preference profiles (e.g., junior, senior, pedantic, pragmatic). The AI Engine has been updated to ingest these configurations and dynamically adapt its system prompt's tone, verbosity, and strictness rules based on the author of the pull request. This ensures juniors get educational feedback while seniors get concise pointers, drastically improving developer acceptance.

Fixes #3123

## 🛠️ Type of Change

- [x] 🚀 New feature (non-breaking change which adds functionality)

## 🧪 How Has This Been Tested?

- [x] **Local Pytest**: Validated that `ai-engine/app.py` properly reads persona configs and adjusts the system prompts correctly.
- [x] **Integration Testing**: Verified end-to-end webhook processing correctly fetches the PR author handle and applies the corresponding tone in the mocked AI response.

## 📋 Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have linked the PR to a specific issue (e.g. `Fixes #12`)
- [x] (GSSoC Contributors) I have added the appropriate `gssoc26` label

---
⭐ **Support RepoSage!** If you find this project helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!
