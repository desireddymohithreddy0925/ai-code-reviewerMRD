## 📝 Description

Implemented the **Custom Rule Enforcement via Natural Language** feature. Teams can now define custom business logic in `.ai-reviewer.yml` using plain English (e.g., "Always use CompanyDateUtils instead of native Date()"). The backend parses these rules via YAML and securely injects them into the AI engine prompt as critical repository rules, ensuring they are actively flagged if violated.

Fixes #3128

## 🛠️ Type of Change

- [x] 🚀 New feature (non-breaking change which adds functionality)

## 🧪 How Has This Been Tested?

- [x] **Backend Tests**: Verified that the config fetching properly extracts `custom_rules` locally.
- [x] **AI Engine Prompting**: Validated that the prompt string interpolates the natural language text and enforces the instructions.

## 📋 Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have linked the PR to a specific issue (e.g. `Fixes #12`)
- [x] (GSSoC Contributors) I have added the appropriate `gssoc26` label

---
⭐ **Support RepoSage!** If you find this project helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!
