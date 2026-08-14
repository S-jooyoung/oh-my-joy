# Contributing

oh-my-joy is a Claude Code plugin whose **behavior is declared in Markdown**. There is little code and the docs are the spec, so most of this repo's discipline is about "what must change together in the same commit".

## Getting started

```bash
git clone https://github.com/S-jooyoung/oh-my-joy.git
cd oh-my-joy
node --test          # no install step — Node 20.11+ is all you need
```

To try it as a plugin in Claude Code:

```
/plugin marketplace add <local path to this repo>
/plugin install oh-my-joy@omj
```

## Never do these

- **Never create `hooks/hooks.json`.** The moment it exists, hooks auto-fire in *every* repo that enables the plugin. Hook scripts are templates in `templates/hooks/`; activation happens only when `/omj-setup` copies them into a consuming project (opt-in). This invariant is test-enforced.
- **Never leave AI signatures in commit messages.** No `Co-Authored-By: Claude`, no "Generated with …".
- **Never declare a tool in `allowed-tools` that the body's procedure does not call.** Deliberately not pre-approving dangerous execution is itself a safety gate (the permission prompt becomes the user's confirmation point).

## What must change together

When you add or change a feature, put all three of the following in **the same commit**. Changing only code without the docs is incomplete.

1. **README** — `README.md` (EN) and `README.ko.md` (KO) **at the same time**. The two files keep the same structure and the same canonical facts.
2. **CHANGELOG** — 1 change = 1 entry.
3. **`docs/PRINCIPLES.md`** — only when a principle, design decision, or mental model changes. If you update it, update the matching row in `docs/PRINCIPLES.en.md` in the same commit.

`tests/docs-consistency.test.mjs` checks the mechanically verifiable part of this discipline (README parity, link reachability, release links, command-list consistency).

## Commits

- Conventional Commits: `<type>(<scope>): <subject>` — `feat`/`fix`/`chore`/`docs`/`refactor`/`test`/`ci`.
- **In English, concise.** The subject says what changed; the body says **why** (what problem existed, which alternatives were rejected).
- **1 commit = 1 concern + that concern's doc updates.** Only the release cut (version bump + CHANGELOG finalization) gets its own commit.

## Adding a new command

- File: `commands/<name>.md`. Naming has two axes — OMJ-specific FE loop verbs take the `/omj-*` prefix (root `/omj` excepted); named methodology/rubric commands (`deep-interview`, `ff-review`, and the like) use an unprefixed basename + registration in `WORKFLOW_COMMANDS` in `tests/plugin-manifest.test.mjs`. Unprefixed commands are always written in docs as the canonical `/oh-my-joy:<name>` invocation (bare notation is blocked by tests).
- frontmatter: `description`, `argument-hint`, `allowed-tools` (**least privilege** — if read-only, do not include `Write`/`Edit`/`Bash`).
- The SoT for behavior is that file's body. Other docs only summarize/link and never redefine thresholds or rules.
- Add it to the README (EN/KO) command tables — tests fail if it is missing.

## Releases

**Deployment model.** The marketplace (`/plugin install oh-my-joy@omj`) does not consume tags; it shallow-clones main HEAD, but **`version` in `plugin.json` is the deployment gate** — until that string changes, existing installs keep their cached version (manual force-update aside). In other words, **the moment a version bump merges to main is the deployment**; tags and GitHub Releases are human-readable history labels. Features piling up on main do not reach users until a release is cut.

Procedure:

1. Describe changes under `[Unreleased]` as usual — prose is human-written (no auto-generation).
2. `node scripts/release.mjs cut --version X.Y.Z` → finalizes the CHANGELOG section, the link definitions, and the 4 version surfaces (plugin.json / marketplace.json ×2 / package.json) in one deterministic transform. Review the diff and polish the prose.
3. On a `release/vX.Y.Z` branch, commit `chore(release): vX.Y.Z` → open a PR with the same title → merge after CI is green.
4. **Tagging and the GitHub Release are automatic** — on the merge push, `.github/workflows/release-tag.yml` attaches the plugin.json version's tag to the just-merged main commit and publishes a Release with that CHANGELOG section as its body. **Manual `git tag` is forbidden** — the incident where the v0.4.0 tag landed on an orphan commit off main is the reason for this rule (partial failures heal via a manual workflow re-run; the logic is idempotent and main-ref-only). A state where the current version's tag exists but the GitHub Release does not (releases predating the automation) is backfilled on the next main push — intended behavior.

`metadata.version` in bundled skills (`skills/*/SKILL.md`) is an independent semver unrelated to the plugin version — bump it only in releases that change skill content (SKILL.md, `references/`).
