# OMJ repository instructions

Read [CLAUDE.md](CLAUDE.md) before working in this repository. Despite its historical filename, it is the shared operating contract for both Claude Code and Codex: scope, documentation, verification, commits, and releases.

Codex maintainer skills are discovered under `.agents/skills/`: `$oh-my-joy:release` runs the OMJ release procedure and `$oh-my-joy:release-checklist` checks release/install readiness. These are repository-local tools. Plugin workflows for consuming projects remain under `skills/` and use `$oh-my-joy:<name>`.

For host-specific behavior, read [the parity inventory](docs/HOST-PARITY.md). Preserve the user's existing authority; mentioning a release or asking about the release skill does not authorize publication.
