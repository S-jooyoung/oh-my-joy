---
name: release-checklist
description: Repo-local OMJ maintainer checklist for preparing a release, diagnosing a stale Claude/Codex installation, or proving a published tag and installed cache match by content hash.
---

# OMJ release checklist

Read [the shared release contract](../../../docs/RELEASING.md) completely. It is canonical for both Claude Code and Codex; this skill does not restate or weaken it.

Use the relevant section for the request:

- **Release readiness:** check clean/main state, `[Unreleased]`, inferred/explicit version, exact five-file cut scope, tests, plugin validation, required eval evidence, and independent release-diff review.
- **Published release:** verify PR merge commit, green checks, matching `release-tag.yml` run, tag target, GitHub Release URL, and recorded content hash.
- **Local installation drift:** inspect only hosts already installed, resolve their exact cache paths, compare `generate-inventory.mjs --dir` output with the Release hash, then distinguish stale cache from stale session.

Diagnosis is read-only unless the user explicitly requests a release, update, or repair. Reuse existing release authorization and avoid duplicate generic confirmation. A repair that removes/re-registers a marketplace, rewrites an install record, merges, or publishes must be specifically within the request.

Never accept version equality alone, use broad staging, commit on a shared branch, force-push, create a manual tag, or treat missing CI checks as green.
