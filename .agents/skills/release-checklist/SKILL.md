---
name: release-checklist
description: Use in the OMJ repository to assess release readiness, verify a published release, or diagnose stale Claude/Codex installations with tag and content-hash evidence.
---

# OMJ release checklist

Read [the shared release contract](../../../docs/RELEASING.md) completely and apply only the section relevant to the user's request. This is a repository-local Codex skill under the canonical `.agents/skills/` discovery path; do not copy it into project `.codex/skills/`.

- For readiness, prove the exact cut scope, tests, validation, eval evidence, and independent diff review.
- For publication, prove the PR merge commit, CI, release workflow, tag target, Release URL, and content hash.
- For installation drift, inspect already-installed hosts, resolve exact cache directories, compare inventory hashes, and distinguish stale files from a stale session.

Default diagnosis is read-only. Mutate an installation, marketplace, branch, PR, or release only when the user explicitly requested that action or already authorized the active release. Version equality is supporting evidence, never content proof.
