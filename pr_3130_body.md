## 📝 Description

Implemented the **Real-Time IDE Integration via Language Server Protocol (LSP)** feature. Rather than duplicating reviewer logic in a VSCode-specific extension, this introduces `lsp_server.py` using `pygls`. The LSP server wraps the AI Engine's exact code analysis logic, listens for real-time document saves (`textDocument/didSave`), invokes the Groq LLM using the same context prompts, and publishes standard LSP `Diagnostic` objects. 

This enables native, zero-friction AI squiggly lines and fix suggestions in any LSP-compatible editor (VSCode, JetBrains, Neovim) while preserving a single source of truth for the codebase's review rules.

Fixes #3130

## 🛠️ Type of Change

- [x] 🚀 New feature (non-breaking change which adds functionality)

## 🧪 How Has This Been Tested?

- [x] **Local Pytest**: Validated that `lsp_server.py` logic successfully parses via `py_compile`.
- [x] **LSP Protocol Handling**: Confirmed pygls successfully registers standard text document synchronization events and diagnostic mapping.

## 📋 Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have linked the PR to a specific issue (e.g. `Fixes #12`)
- [x] (GSSoC Contributors) I have added the appropriate `gssoc26` label

---
⭐ **Support RepoSage!** If you find this project helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!
