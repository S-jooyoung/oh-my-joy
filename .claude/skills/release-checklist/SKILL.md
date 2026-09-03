---
name: release-checklist
description: Maintainer checklist for shipping an OMJ change and getting it onto this machine — pre-flight gates, the release cut, the local apply loop, and a drift check that explains "already at the latest version" when a release has clearly shipped. Use when cutting a release, when a merged command does not appear after /plugin, or when verifying that the installed plugin matches the repo.
---

# OMJ release checklist

Repo-local skill for maintainers. It is not plugin content and is never shipped to users —
it lives under `.claude/skills/` so it loads only while working inside this repository.

`CONTRIBUTING.md` ("Releases") owns the authoring and release-cut procedure and stays canonical.
This skill exists for the part nothing else covers: **getting a shipped release onto the
maintainer's own machine, and proving it landed.** CI cannot cover that step because it is
local machine state.

## The deployment model that surprises people

`CONTRIBUTING.md` describes the model for **installed users**: the marketplace shallow-clones
main HEAD and `version` in `plugin.json` is the deployment gate, so a version bump merging to
main is the deployment.

A maintainer's own machine usually does **not** use that path. Check it:

```bash
node -p "require(process.env.HOME+'/.claude/plugins/known_marketplaces.json').omj.source"
```

If it prints `{ source: 'directory', path: '.../oh-my-joy' }`, the marketplace serves **your local
working tree**, not GitHub. Two consequences follow, and both have already caused a lost hour:

1. **`git pull` is the deployment.** A GitHub release, tag, and green CI put nothing on this
   machine. Until the local clone is pulled, `/plugin` correctly reports the old version as latest.
2. **Directory sources are not auto-refreshed.** They have no remote to fetch, and the `omj` entry
   carries no `autoUpdate` flag, so a background update pass that refreshes git-backed marketplaces
   skips it. Its metadata keeps the timestamp of the last explicit read.

So after pulling, the marketplace metadata must be re-read **explicitly**. That single missing
command is what makes `/plugin` keep insisting the old version is current.

## Drift check — run this first, always

Four values. If they disagree, the mismatch names the fix.

```bash
REPO=~/projects/oh-my-joy
node -p "require('$REPO/.claude-plugin/plugin.json').version"                                              # 1 repo version
node -p "require(process.env.HOME+'/.claude/plugins/installed_plugins.json').plugins['oh-my-joy@omj'][0].version"  # 2 installed version
git -C $REPO log -1 --format=%cI                                                                           # 3 repo HEAD time
node -p "require(process.env.HOME+'/.claude/plugins/known_marketplaces.json').omj.lastUpdated"              # 4 marketplace last read
```

| Symptom | Meaning | Fix |
| --- | --- | --- |
| 1 = 2 | Installed build matches the repo | Nothing to do |
| 1 > 2 | Release exists locally but is not installed | Run the local apply loop |
| 4 < 3 | Marketplace metadata predates the last pull | `claude plugin marketplace update omj`, then apply |
| 1 = 2 but a command is missing | Installed files are current; the session is not | Restart Claude Code |

Reading the version alone is not enough — a missing command can mean either a stale install or a
stale session, and only value 4 versus 3 separates them.

## A. Pre-flight (before merging a version bump)

- [ ] `npm test` passes — this is the real gate. It covers the four version surfaces in lockstep,
      CHANGELOG links and skeleton, README EN/KO parity, command-list consistency, and standalone gating.
- [ ] `npm run eval` was run for every command whose body changed (native `claude plugin eval` when enabled, otherwise the fallback runner) and the before/after scores are in the PR's test plan. `/skill-doctor` (early access) shows no never-invoked surfaces you did not expect.
- [ ] `npm run validate-plugin` passes — two-layer manifest check. It fails on **any** warning
      except the one allow-listed `CLAUDE.md` message, so a new warning is a hard stop, not advice.
- [ ] New or changed command: frontmatter carries `description`, `argument-hint`, and least-privilege
      `allowed-tools`; no declared tool the body never calls. See `CLAUDE.md` "Command / agent / hook rules".
- [ ] Docs changed together: `README.md` **and** `README.ko.md`, CHANGELOG entry, and
      `docs/PRINCIPLES.md` when a principle or mental model moved. See `CONTRIBUTING.md`.
- [ ] Every tracked markdown file is English. The language check is a **denylist** — only
      `README.ko.md` and `CHANGELOG.md` are exempt, so a new document is English by default.
      For `commands/`, `agents/`, and `skills/` the exemption covers frontmatter only; paths outside
      those prefixes, including this file, must be fully English.

> **Sections B and C are automated by `/release`** (`.claude/commands/release.md`): it cuts, opens the PR, waits for CI, merges, waits for the tag, and runs the local apply loop plus the drift check above. Keep reading when you need to do a step by hand or diagnose why one did not land.

## B. Release cut

- [ ] `[Unreleased]` prose is written by a human — the script performs no summarizing.
- [ ] `node scripts/release.mjs cut --version X.Y.Z` — one deterministic transform across the four
      version surfaces plus the CHANGELOG section and its links. **Never hand-edit a version string.**
- [ ] Review the result as a diff; polish prose.
- [ ] Branch `release/vX.Y.Z`, commit `chore(release): vX.Y.Z`, PR with the same title, merge on green CI.
- [ ] Tag and GitHub Release are automatic via `.github/workflows/release-tag.yml`.
      **Manual `git tag` is forbidden** — an orphan-commit tag incident is the reason.

## C. Local apply — the step that is easy to skip

```bash
git -C ~/projects/oh-my-joy pull        # 1 directory source: this IS the deployment
claude plugin marketplace update omj    # 2 force a metadata re-read; nothing else does this
claude plugin update oh-my-joy@omj      # 3 install the new version
# 4 restart Claude Code
```

Step 4 is required, not cautionary: the update command itself reports "Restart to apply changes",
and plugin components are not hot-swapped inside a running session. `/reload-plugins` is not enough.

If step 2 does not take effect, re-register the marketplace:

```bash
claude plugin marketplace remove omj
claude plugin marketplace add ~/projects/oh-my-joy
claude plugin update oh-my-joy@omj
```

This rewrites the install record, so confirm the plugin is still installed afterwards.

## D. Verify the install landed

- [ ] `claude plugin list` shows the expected version for `oh-my-joy@omj`.
- [ ] `ls ~/.claude/plugins/cache/omj/oh-my-joy/` contains a directory for the new version.
- [ ] New commands are present in `<version>/commands/`, and any renamed predecessor is **gone**.
      A rename is two facts, and only checking for the new name hides a half-applied update.
- [ ] `claude plugin details oh-my-joy@omj` lists the expected commands and agents.
- [ ] After restarting, the command is invocable as `/oh-my-joy:<name>`.

## E. Failure modes seen in practice

- **"already at the latest version" right after a release.** The local clone was behind, or the
  marketplace metadata was never re-read after the pull. Run the drift check; compare 4 against 3.
- **A command is missing but the version is correct.** The session predates the install. Restart.
- **Looking for a command in the skills list.** Most OMJ workflows are **commands**, not skills.
  `skills/` has held a single bundled skill for several releases; a new workflow appearing under
  `commands/` will never show up in a skills listing.
- **A rename looks like a regression.** `omj-review` became `ff-review` in 0.6.0. Personal notes and
  aliases holding the old name break at the rename, not at the update.
