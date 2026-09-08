# OMJ maintainer release contract

This is the shared release source of truth for this repository. The repo-local Claude command and Claude/Codex skills adapt host syntax and tools; they do not change the sequence, evidence, or authority boundary. These maintainer surfaces are not registered as plugin workflows; hosts discover them only while working in this checkout.

## Authority and stop points

A maintainer's explicit request to cut and ship a release authorizes the release branch, commit, push, release PR, green-CI merge, automatic tag/Release wait, and local installation refresh described here. Reuse that authorization; do not add a generic confirmation. `--pr-only`, or wording limited to preparing/opening a release PR, stops after PR readback.

If the request does not clearly authorize external publication, prepare the exact version, cut diff, tests, and release review first. Then use the host's structured input once to present those concrete results and ask whether to merge/publish, stop at the PR, or abort. A rejected or absent answer leaves the prepared branch intact and performs no external write beyond what was already authorized.

Never infer permission for a major bump, unrelated changes, failed-CI merge, manual tag, force-push, or release outside this repository. Host or repository protection gates still apply.

## 1. Preflight and version

Run from the repository root with Node.js 20 or newer. Require:

- a completely clean worktree and index;
- `gh auth status` success;
- `main` available and fast-forwardable from `origin/main`;
- no active release branch or open release PR for the selected version.

Switch to `main`, pull with `--ff-only`, and confirm it equals `origin/main`. Do not commit on `main` or another shared branch.

Choose the version from `--version`, or run `node scripts/release.mjs next` with an optional `--bump`. The script's inference is authoritative: removals, changes, or deprecations imply minor; additions and fixes imply patch; major is explicit only. Empty `[Unreleased]`, an existing version tag, or an existing release PR stops the run before creating a branch.

## 2. Prepare and prove the cut

Create `release/vX.Y.Z`, then run `node scripts/release.mjs cut --version X.Y.Z`. Never edit version strings or CHANGELOG links manually.

The cut must change exactly these paths:

```text
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.codex-plugin/plugin.json
CHANGELOG.md
package.json
```

Compare `git diff --name-only` with that list and stop on any extra or missing path. Review the actual diff and confirm:

- all manifest/package versions and both marketplace version occurrences equal X.Y.Z;
- the previous `[Unreleased]` prose moved verbatim under `## [X.Y.Z]`;
- the new `[Unreleased]` six-section skeleton is empty;
- version links point to the previous tag, X.Y.Z, and `HEAD` correctly;
- no generated summary, unrelated prose, or manual tag command entered the diff.

Run `git diff --check`, `npm test`, and `npm run validate-plugin`. For every changed workflow body, confirm the required targeted eval evidence exists under the project eval policy; run the missing targeted case before release. Review the release diff independently for changed-file scope, version/link consistency, test evidence, and the automatic tag path. A failing check or review leaves the branch and diff for repair and does not commit or push.

## 3. Commit and release PR

Stage the five explicit paths above, never `git add -A` or `git add .`. Re-read the staged name list and diff, then commit `chore(release): vX.Y.Z` without AI attribution or hook bypass. Push the release branch normally; never force-push.

Open a PR with the same title. Its body includes the released CHANGELOG section, exact changed files, test/eval/validation evidence, and the fact that `release-tag.yml` creates the tag and GitHub Release after merge. Read the PR back and record:

- canonical PR URL and number;
- base `main`, head `release/vX.Y.Z`, and head SHA equal to the local commit;
- the five expected changed paths and no others.

`--pr-only` ends here with that evidence.

## 4. CI, merge, tag, and Release

Fresh PRs may temporarily report no checks. Treat that as pending, never green. Poll for up to two minutes until at least one check appears, then watch all required checks. Any failure or timeout stops without merging and reports the PR plus failing/pending check URLs.

With release authority and green CI, squash-merge through GitHub and delete the remote release branch. Read the PR again and record the merged state and merge commit SHA. Do not merge locally or push to `main`.

Wait for the `release-tag.yml` run whose `headSha` equals that merge commit, then watch it with exit status. On failure, report the run and use only the workflow's main-ref `workflow_dispatch` recovery when explicitly authorized. Never run `git tag` or move a tag manually.

Read back release `vX.Y.Z` and prove:

- the Release URL and tag are present;
- the annotated tag ultimately resolves to the recorded merge commit;
- the Release body contains one 64-character `Content hash`;
- the successful `verify-release` job checked the tag tree against that hash.

Resolve the tag without changing it: inspect `refs/tags/vX.Y.Z` and its peeled `refs/tags/vX.Y.Z^{}` target with `git ls-remote origin`. For an annotated tag, the peeled target must equal the recorded merge commit.

Pull local `main` with `--ff-only` and confirm it contains the merge commit before updating installations.

## 5. Refresh installed hosts

Refresh only hosts that are already installed on this machine. Do not install a new host or convert marketplace source types as part of a release.

Local-directory marketplaces can copy ignored non-runtime artifacts such as `evals/results/`. Compare the source directory inventory with the tracked release inventory before refreshing. Temporarily relocate only confirmed untracked artifacts outside the source, preserve them, and restore them after the refresh even when it fails. Keep release evidence intact; do not hide unexpected cache files by excluding them from the integrity calculation. Root operational directories are excluded by the inventory helper, while nested shipped fixtures remain included.

### Claude Code

Detect `oh-my-joy@omj` with `claude plugin list` and inspect `~/.claude/plugins/known_marketplaces.json` plus `installed_plugins.json`. For an installed copy:

```text
claude plugin marketplace update omj
claude plugin update oh-my-joy@omj
claude plugin list
claude plugin details oh-my-joy@omj
```

A local-directory marketplace still needs the explicit metadata update after the clone is pulled. Re-registering the marketplace is a repair operation, not the normal update path, and requires a concrete diagnosed mismatch.

### Codex

Repo-local maintainer skills are discovered canonically from `.agents/skills/`; do not duplicate them under project `.codex/skills/`. Detect the installed plugin with:

```text
codex plugin list --marketplace omj --json
```

For an installed copy, use the CLI 0.153.4 contract:

```text
codex plugin marketplace upgrade omj --json
codex plugin add oh-my-joy@omj --json
codex plugin list --marketplace omj --json
```

Codex has no `plugin install` or `plugin update` subcommand. `plugin add` installs or refreshes the selected marketplace plugin. A failure caused by another broken configured marketplace is reported separately; the scoped `--marketplace omj` readback remains the OMJ evidence when it succeeds.

## 6. Verify installed content

Version equality alone does not prove the same contents are installed. For Claude Code, take the exact cache path from `installed_plugins.json`. For Codex, take the marketplace, plugin ID, and version from the scoped JSON readback, then require exactly one matching directory under `$CODEX_HOME/plugins/cache/<marketplace>/<plugin>/<version>` when `CODEX_HOME` is set, otherwise `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>`; zero or multiple matches are a blocker, not permission to guess. For each installed host:

1. Resolve the exact cache directory from that host's installation metadata and the rule above.
2. Confirm both manifests and the required released workflow files exist there.
3. Run `node scripts/generate-inventory.mjs --dir <exact-cache-directory>`.
4. Require its plugin name and version to equal the Release and its `sha256` to equal the Release `Content hash`.

If the version matches but the hash or required files differ, the install is stale or contaminated; do not report success. If cache contents match but the current session lacks a new command/skill, the session is stale. Restart Claude Code after its update. Start a new Codex session after plugin or repo-local skill changes; Codex may discover skill edits automatically, but a new session is the reliable post-release proof boundary.

After restart/new session, verify one released surface is discoverable in each installed host. This is a readback check, not another installation mutation.

## Release report

Report only verified values:

```md
## Release vX.Y.Z
- PR: <url> · merged at <sha>
- Release: <url> · tag resolves to <sha>
- Integrity: <content-hash> · verify-release passed
- Claude Code: <not installed | version, cache hash, restart/readback>
- Codex: <not installed | version, cache hash, new-session/readback>
- Remaining: <none | exact failed gate and recovery>
```

Keep the release open until every authorized step has readback evidence or a real blocker is reported.
