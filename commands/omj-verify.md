---
description: Visually verify a route — check against the design/spec. playwright-cli first, playwright MCP fallback when absent (run outside Plan mode)
argument-hint: "<route> [--base <url>]"
allowed-tools: Read, Bash(playwright-cli:*), Bash(curl:*), Bash(command -v:*), mcp__playwright__*, mcp__plugin_playwright_playwright__*
---

# /omj-verify — Visual verification (active op)

Opens the implemented screen in a real browser and inspects deviations from the design/spec.

> ⚠️ This command is a **report-only observation op that never modifies source** — but it uses side-effect Bash (browser launch, screenshot writes), so it is not zero-bash read-only; Plan mode blocks such side-effect Bash (read-only Bash is allowed), so verification will not run there. Exit Plan mode before running. `Read` is used only to load baseline PNGs and parse `.omj/fe-context.md` (no source modification).

## Arguments

- `<route>` — the path to verify (e.g. `/settings/profile`). **If the route is missing**, print the usage below and stop (verification is impossible without knowing which route the component mounts on). You can copy the `Verification route (inferred):` value from an `/omj` spec.
- `--base <url>` — base URL override (defaults to `http://localhost:3000`). e.g. `--base http://localhost:5173` (Vite).

> ℹ️ Slash commands are not a shell, so an **inline env prefix like `JOY_BASE_URL=... /omj-verify` does not apply.** For a different port use the `--base` argument, and `export` env vars such as login credentials in the shell *before* running.

## Variable resolution (pin as shell variables before running snippets)

```bash
ROUTE="…"   # ← must be substituted with the route argument (e.g. /settings/profile). Literal <route> forbidden
BASE="${JOY_BASE_URL:-http://localhost:3000}"   # overridden by the --base argument when present
```
> **Actually substitute** `ROUTE` with the user-provided route argument. `BASE` precedence: `--base` > exported `JOY_BASE_URL` > `http://localhost:3000`.

> ⚠️ **Argument validation (mandatory before substitution).** `ROUTE`·`BASE` are the only points where user input enters shell commands. Check the following *before* substituting; if anything is off, do not substitute — stop with "invalid argument format".
> - `ROUTE` starts with `/` and contains no whitespace, newline, quote, backtick, `$`, `;`, `&`, `|`, `<`, `>`, `(`, `)` (if a query string's `?`·`=`·`&` is needed, keep the whole value double-quoted; `&` is a shell separator, so remove it from the route and handle it per the baseline slug rules).
> - `BASE` is a URL starting with `http://` or `https://` and contains none of the same metacharacters.
> - Both values are only ever used as **double-quoted variable references** like `"$ROUTE"`/`"$BASE"` in snippets (never expand the values onto the command line).

### `<route-slug>` conversion rules (baseline file key)

route → filename slug: strip the leading `/`, inner `/`→`-`, drop the query string, root `/` becomes `root`, collapse trailing/duplicate `-`. e.g. `/settings/profile/` → `settings-profile`, `/` → `root`. The viewport label is the viewport this verify run uses (`desktop`|`mobile`).

## Preflight (exit gracefully on failure)

1. **Capture backend**: if `command -v playwright-cli` succeeds, use playwright-cli. **Otherwise check whether the session has playwright MCP tools (`mcp__playwright__*`)**; if so, perform the same procedure below with them (navigate → accessibility snapshot → screenshot → baseline comparison) (fallback — same procedure, different tools). If neither exists → print "no capture backend — skipping verification. Install: `npm i -g playwright-cli` or enable the playwright MCP (see `/omj-setup`)" and stop.
2. **Server up**: if `curl -sf "$BASE" >/dev/null` fails (non-200) → announce "dev server not running — start it with `yarn dev` and rerun, or skip verification" and stop (no auto-start).
3. **Project verification procedure**: if the repo root `.omj/fe-context.md` declares `verifySetup:`, `Read` that document and apply the auth-bypass/API-mock procedure **before observing** (skip if absent — graceful).

## Verification procedure

Keep the session name `-s=omj` (with the playwright MCP fallback, the MCP browser tab takes the place of the session concept).

```bash
playwright-cli -s=omj open "$BASE$ROUTE" --persistent
playwright-cli -s=omj goto "$BASE$ROUTE"
playwright-cli -s=omj snapshot      # structural (accessibility tree) check
playwright-cli -s=omj screenshot    # visual check
```

- **Auth-redirect handling (*after* open/goto)**: if the navigation above redirects to a login page, re-login with `fill`+`click` using the `verifySetup` procedure (if declared) or pre-exported credential envs (`$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`), then `goto` again. With neither → announce "route requires auth — log in manually in the browser and rerun". (Redirects are only observable after the page is opened, so this is handled here, not in preflight.)
  - **Credential handling rule**: pass only **variable references** like `"$JOY_TEST_PASSWORD"` to `fill` — never resolve the value into command lines, reports, or error messages (it would persist in the transcript as plaintext). Use **test-only accounts** exclusively.
  - **Persistence caution for post-auth screens**: screenshots captured after login may contain session/personal data. Tell the user before persisting one to disk as a baseline.
- **Reached-route validation (mandatory before using a capture as evidence)**: confirm from the `snapshot` result that the current URL/page context actually reached `"$ROUTE"`. If a redirect landed elsewhere (login, home, …), do not compare that capture against the reference — **report "expected route not reached (redirected)" as a failure**. Capturing the wrong screen and reporting "matches" is this command's most dangerous silent mis-verification failure mode. If still unreached after re-login, stop here (no forced comparison guessing).
- **Baseline persistence (observation stage)**: if the session context contains the Figma asset URL from an `/omj` spec, persist the PNG:
  ```bash
  curl -f --remove-on-error --create-dirs -o ".omj/baselines/<route-slug>@<viewport>.png" "<asset-url>"
  ```
  `-f` is mandatory (prevents a 403/404 error body being silently saved as a PNG), `--remove-on-error` is mandatory (prevents 0-byte leftovers on failure). On non-zero exit → advise "baseline expired (asset URLs last ~7 days) — rerun `/omj` to refresh" and continue. **The URL source is session context only** (re-fetching URLs from spec files is a v1.1 follow-up). Cross-session comparison is owned by the on-disk PNG in ② below.
- **Comparison reference (3 tiers)**: ① if the immediately preceding `/omj` session context has the Figma reference image, compare against it. → ② otherwise, if `.omj/baselines/<route-slug>@<viewport>.png` exists and is **non-empty**, `Read` and compare (the viewport label is the verify-run viewport and may differ from the recorded design frame — the common single-frame case matches). → ③ with neither, inspect only the route's own structure/accessibility/layout (no forced comparison guessing without a baseline).
- **Output**: group differences by severity (🔴/🟡/🟢) as `element·position + observed difference + recommended fix`. Prioritize FF accessibility (alt·labels·touch targets) and token deviations (raw hex etc., per `figma-fidelity.md`).
- When done, always clean up the session with `playwright-cli -s=omj close` (with the MCP fallback, close the tab).

## Usage (when the route is missing)

```
/omj-verify <route>                 e.g. /omj-verify /settings/profile
/omj-verify <route> --base <url>    e.g. /omj-verify / --base http://localhost:5173
# for auth routes: declare verifySetup in .omj/fe-context.md (recommended), or beforehand in the shell
#   export JOY_TEST_EMAIL=... JOY_TEST_PASSWORD=...
```

> **Always** add `.omj/baselines/` to the consuming project's `.gitignore` — not only is it a generated artifact, screenshots of authenticated screens may contain personal data and could get committed.
