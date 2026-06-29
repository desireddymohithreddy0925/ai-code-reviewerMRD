# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Backend**: Enforced max file-size safety guardrails before LLM context payload delivery. Files exceeding 100KB are skipped, logged, and returned in the `/api/analyze` response under `skippedFiles` (Issue #999).
- **Frontend**: Add a clear-filter ("X") button to the File Tree Search component.
