## 📝 Description

Implemented the **Language-Agnostic Semantic Code Search API** feature. Integrated a semantic duplication detection layer into the AI Engine's workflow. Before executing standard reviews, the engine generates embeddings for the new code chunks and queries a `chromadb` vector database populated with the existing repository's codebase logic. If highly semantically similar code is detected, it automatically leaves a contextual comment suggesting the developer reuse the existing function or component, drastically reducing code bloat.

Fixes #3125

## 🛠️ Type of Change

- [x] 🚀 New feature (non-breaking change which adds functionality)

## 🧪 How Has This Been Tested?

- [x] **Local Pytest**: Validated integration with local `chromadb` instances and proper embedding extraction.
- [x] **End-to-End Simulation**: Ensured semantic matches reliably generate duplicate-code review suggestions within the review thread.

## 📋 Checklist:

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] I have linked the PR to a specific issue (e.g. `Fixes #12`)
- [x] (GSSoC Contributors) I have added the appropriate `gssoc26` label

---
⭐ **Support RepoSage!** If you find this project helpful, please consider giving us a **Star** 🌟 on GitHub! Your support helps us win GSSoC '26 and grow professionally!
