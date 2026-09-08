# Codex setup contract

This is the Codex mapping of OMJ's dependency doctor and opt-in scaffolding. The public entry is `$oh-my-joy:setup`. `--check` only inspects; it never asks for choices or mutates configuration. A normal setup changes only items selected by the user or already named in the current request.

## Inspect before proposing changes

| Item | Evidence |
| --- | --- |
| OMJ plugin | `codex plugin list --marketplace omj --json`; inspect the installed version and required skill files |
| Figma and documentation | `codex mcp list --json`, installed plugin metadata, and tools exposed in this session; configuration alone is not a successful capability call |
| Browser capture | exposed browser/computer-use/Playwright tools or `command -v playwright-cli` |
| Parallel execution | native agent tools actually exposed; Codex does not use Claude's Agent Teams environment flag |
| Project declaration | `.omj/fe-context.md`, declared `tokensPath`, `storybook`, `contextDocs`, and existing design documentation |
| Frontend hooks | supported installed hook schema, trusted project, `.codex/hooks.json`, and the adapter/check copies |
| Answer style | the effective root `AGENTS.override.md` or `AGENTS.md` and its `.omj/answer-style.md` reference |
| CLI indicators | installed support for `[tui].status_line`, current effective configuration, and whether this is a CLI or App session |

Inspect `AGENTS.md`, applicable overrides/rules, and existing user configuration before proposing changes. Do not dump credentials or unrelated configuration into the report. For Figma, distinguish authentication, tool access, and file edit permission. Confirm the selected integration's documented requirements rather than assuming that registration proves a desktop file is accessible.

## Diagnose a shortened skill catalog

Codex first receives each skill's name, description, and path, then reads the selected `SKILL.md`. The initial catalog has a separate context budget, and Codex shortens descriptions before omitting skills. A warning therefore concerns discovery metadata, not proof that a selected skill body was truncated. See the [official skill loading model](https://developers.openai.com/codex/skills/) and [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference#configtoml).

Keep these four states separate:

| State | Question to answer |
| --- | --- |
| Source | Which current `SKILL.md` files and descriptions does the repository or marketplace publish? |
| Installed cache | Which versioned plugin directory is this Codex installation actually loading, and does its content match the source or release? |
| Native CLI inventory | What does an initialized app-server `skills/list` call with `forceReload: true` report for this working directory and effective configuration? |
| Session | Did a fresh CLI or App session using that inventory display shortening, select the expected skill, and read its full body? |

For the native inventory, record enabled entries only, group their counts by `pluginId` (with repository, user, admin, and system entries kept distinct), and list the longest descriptions with their resolved paths. This finds the plugin or scope consuming the catalog without guessing from checked-out files. Resolve symlinks and versioned cache paths before comparing content. A CLI result proves the CLI configuration and model tested; it does not prove the Codex App used the same catalog. If stderr warning capture is unavailable, record the warning as `unobserved`, not absent.

Apply remedies in this order:

1. Update OMJ, start a fresh session, and repeat the same-model, same-configuration inventory and smoke protocol in [EVALS](EVALS.md#codex-native-skill-catalog-smoke).
2. If the combined catalog still shortens, disable only a user-selected nonessential external skill. Resolve the current installed `SKILL.md` path first; versioned cache paths can change after an upgrade. The official full-file override is:

   ```toml
   [[skills.config]]
   path = "/absolute/current/path/to/nonessential-skill/SKILL.md"
   enabled = false
   ```

   Restart Codex and read back `skills/list`. To restore it, keep the same resolved path and set `enabled = true` (or remove that exact override), restart, and verify the entry returned.
3. Consider a temporary `skills.max_context_tokens` comparison only when shortening persists under the same model and configuration **and** the effective catalog budget is confirmed below `10000`. An unknown budget is not evidence that it is low. Explicit values are capped at `10000`:

   ```toml
   [skills]
   max_context_tokens = 10000
   ```

   Restore the prior value after the comparison and repeat `skills/list` plus the smoke. Do not apply this or any other user-global configuration change automatically.

`allow_implicit_invocation: false` changes whether a skill may be selected from an unqualified prompt; it is not documented as catalog-context savings and is not a remedy for this warning. This diagnosis adds no setup behavior: `$oh-my-joy:setup --check` remains read-only, and normal setup still changes only explicitly selected items.

## Selected integrations and project files

Bundle concrete missing items into one structured choice. Each option names the files or exact command that will change. A directly requested setup item already has authorization; do not ask about it again.

- Plugin integrations: inspect the available marketplace/catalog and installed CLI help, then use `codex plugin add <verified-plugin>@<verified-marketplace> --json` for the chosen entry. Do not invent a Figma/Context7 marketplace identifier. Read back the installed plugin and exposed capability.
- MCP integrations: use the chosen provider's official setup instructions and the current `codex mcp add` syntax. Propose its exact transport and URL/command before modifying registration. Keep authentication in the host's supported flow.
- Browser tooling: when selected and no capture backend exists, install `playwright-cli` with its verified package command or register the chosen MCP. One working backend is sufficient.
- `.omj/fe-context.md`: follow [the shared declaration format](../skills/frontend-fundamentals/references/fe-acceptance.md). Reference existing rules through `contextDocs:`. Detect a real token file before populating `tokensPath`; leave `acceptance` and `decisions` empty and detected verification commands commented until the project adopts them.
- `.omj/.gitignore`: preserve existing entries and add `baselines/` and `goals/` when selected. Do not ignore all of `.omj/`; the declaration and chosen answer style remain shareable.
- `docs/DESIGN.md`: after the declaration is accepted, offer an empty scaffold for brand personality, color/spacing use, composition, and Figma naming. Reuse existing design docs when present, otherwise create the agreed file and link `designDocPath:` in fe-context. Do not invent brand decisions.

Global plugin/MCP/package changes require selection of that exact item. Project setup does not otherwise edit user-global Codex configuration or any Claude settings. Unselected items remain guidance only. Setup never grants itself additional host permissions.

## Frontend hooks

Current Codex [hook input](https://learn.chatgpt.com/docs/hooks) identifies patch writes as `tool_name: apply_patch` with patch text in `tool_input.command`. Claude's `tool_input.file_path` hooks cannot be installed unchanged.

For selected checks:

1. Require a trusted Git worktree and confirm project hooks are supported by the installed Codex version. If unsupported, report the limitation; do not fabricate registration or call an unverified install complete.
2. Copy [the Codex adapter](../templates/hooks/codex-post-tool-use.mjs) into `.codex/hooks/`, together with selected `check-design-tokens.mjs` and/or `check-story-exists.mjs` from the same template directory. Propose tokens only for a declared store and Story checking only where Storybook is used.
3. Merge [the hook registration template](../templates/codex/hooks.json) into `.codex/hooks.json`. Preserve unrelated hooks and avoid duplicate OMJ handlers. Both the POSIX command and Windows `commandWindows` PowerShell variant resolve the Git root because hooks run with the session's possibly nested working directory. Confirm Node, Git, and the selected host shell are available.
4. Compare existing copies before replacing them. Preserve user customizations; describe a differing copy and obtain a selected replacement rather than silently overwriting it.
5. In a disposable project fixture, send one real-shaped PostToolUse payload to the installed copy and verify JSON warning/context with exit 0. Verify a token-reference/no-declaration case is silent. Confirm project discovery and each hook definition's trust separately with the native hook inspection surface. Project trust does not automatically trust a new hook definition: respect the host's review gate and report `configured, awaiting hook trust` until it is trusted. A successful subprocess alone does not prove host execution.

The adapter parses native patch envelopes and standalone `apply_patch` heredocs. It does not execute input or guess targets from arbitrary Bash commands, MCP calls, or `tool_response`. Deleted and out-of-project paths are skipped. These checks are advisory and fail open; they are not exhaustive write enforcement. No plugin-level automatic hook is installed.

## Answer style in CLI and App

Codex uses [project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md) for this capability. On selection, copy the body of [OMJ's shared answer style](../output-styles/oh-my-joy.md), without YAML frontmatter, into `.omj/answer-style.md`. Inspect an existing copy before updating it.

The effective root instruction file is `AGENTS.override.md` when it exists, otherwise `AGENTS.md`. Preserve every unrelated instruction and append or update only this block:

```md
<!-- OMJ:ANSWER-STYLE:START -->
Read `.omj/answer-style.md` for the project's selected response style. Keep all other coding and repository instructions in force.
<!-- OMJ:ANSWER-STYLE:END -->
```

Do not replace the instruction file, add duplicate blocks, or change `model_instructions_file`/global `developer_instructions`. If an existing override or nested instruction supersedes the block, report that effective scope instead of claiming project-wide activation. Read back the preserved instructions and copied style, then use a new session to prove loading.

## Codex CLI status indicators

Codex CLI supports a native footer through [TUI configuration](https://learn.chatgpt.com/docs/config-file/config-reference). On selection, merge this into the trusted project's `.codex/config.toml`, preserving existing keys and tables:

```toml
[tui]
status_line = ["model-with-reasoning", "git-branch", "context-remaining", "five-hour-limit", "weekly-limit"]
```

Inspect an existing `status_line` before replacing its chosen indicators. Use the installed schema/item list rather than inventing keys; verify that Codex accepts the resulting project configuration. The native `/statusline` picker is also available in the CLI.

This displays supported model, branch, context, and quota indicators. It does not run the Claude HUD bundle or promise identical Claude subscription metrics. Codex App has no documented custom TUI footer: preserve the selected project configuration for CLI use and report the App limitation, without claiming a custom in-app HUD was installed.

## Finish and optional support

Record a selected setup receipt under `.omj/setup.json` with changed items and verification gaps. `--check` does not write this receipt. Subsequent checks compare current files, not merely that receipt's timestamp.

As in Claude setup, an optional GitHub star can be offered separately after setup succeeds. Check authentication and current star read-only first; an explicit “star it” choice is the only authority for `gh api user/starred/S-jooyoung/oh-my-joy -X PUT`. Declining, authentication failures, and API failures never block setup. Do not post any other message.

Report actual installed/configured/verified states, changed files, and any restart or missing host capability. New plugin/components may need a new Codex session; a configured entry is not proof that the current session has loaded it.
