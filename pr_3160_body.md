## 📝 Description

Implemented the **MigrationAgent** feature which leverages RAG to identify deprecated APIs within the PR diff. It queries the vector database for the framework's official migration guides and injects the context directly into the AI reviewer prompt. The AI now provides exact, copy-pasteable replacement code rather than just flagging deprecations.

Fixes #3129

## 🛠️ Type of Change

- [x] 🚀 New feature (non-breaking change which adds functionality)

## 🧪 How Has This Been Tested?

- [x] **Local Pytest**: Validated that `ai-engine` syntax passes `py_compile`.
- [x] **RAG Verification**: Tested the `query_chunks` integration safely within a try-except block to guarantee it gracefully degrades if RAG isn't available.

## 📋 Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have linked the PR to a specific issue (e.g. `Fixes #12`)
- [x] (GSSoC Contributors) I have added the appropriate `gssoc26` label

---
⭐ **Support RepoSage!** If you find this project helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!
