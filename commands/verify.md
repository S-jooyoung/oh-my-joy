---
description: Prove the work. With a route, open it in a real browser and check it against the design/spec (playwright-cli first, playwright MCP fallback); without a route, run the project's verification commands and record evidence (command · exit code · summary). Report only; run outside Plan mode
argument-hint: "[<route>] [--base <url>]"
allowed-tools: Read, Bash(playwright-cli:*), Bash(curl:*), Bash(command -v:*), mcp__playwright__*, mcp__plugin_playwright_playwright__*
---

# /oh-my-joy:verify — Verification with evidence (report only)

Show whether the implemented work matches what was promised, and leave evidence behind. Two modes, chosen by the arguments:

- Browser mode (a route is given) — open the screen in a real browser and inspect deviations from the design or spec.
- Evidence mode (no route) — run the project's verification commands and record the results as an evidence table. This is the verification step for backend, script, and tooling work, and for frontend work whose proof is a test suite.

Neither mode modifies source. Browser mode uses side-effect Bash (launching a browser, writing screenshots and baselines under `.omj/baselines/`), so Plan mode blocks it; leave Plan mode before running. `Read` is used only for baseline PNGs, `.omj/fe-context.md`, `package.json`, and the spec.

## Arguments

- `<route>` — the path to verify, for example `/settings/profile`. Copy it from the `Verification route` line of the spec when there is one. Omitting it selects evidence mode.
- `--base <url>` — dev server base URL (default `http://localhost:3000`; Vite projects typically need `--base http://localhost:5173`).

Slash commands are not a shell, so an inline env prefix like `JOY_BASE_URL=… /oh-my-joy:verify` does not apply. Use `--base`, and `export` login credentials in the shell before running.

## Evidence mode

1. Discover the commands in this order and stop at the first source that yields any: the approved spec's "Verification commands" in session context; `verifyCommands:` in `.omj/fe-context.md`; `package.json` scripts named `typecheck`, `lint`, and `test`. If none exists, print "no verification command declared — add `verifyCommands:` to `.omj/fe-context.md` or a `test` script" and stop; guessing a command would produce evidence about the wrong thing.
2. Run each command. These commands are deliberately not pre-approved, so each raises a permission prompt — that confirmation is what makes the evidence trustworthy.
3. Record one row per command: the command line, the exit code, and a one-line summary of the output (counts, the first failure). Secrets and personal data never go into the summary.
4. Verdict: pass when every exit code is 0, otherwise fail, with the failing rows first. Suggest the next step: `/oh-my-joy:ship` on pass, a fix on fail.

## Browser mode

### Variables

Pin these as shell variables before running any snippet, then use them only as double-quoted references (`"$ROUTE"`, `"$BASE"`), never expanded onto a command line:

```bash
ROUTE="…"   # the route argument, e.g. /settings/profile
BASE="${JOY_BASE_URL:-http://localhost:3000}"   # overridden by --base when present
```

Validate both before substituting, because they are the only points where user input enters a shell: `ROUTE` starts with `/` and contains no whitespace, quotes, backticks, `$`, `;`, `&`, `|`, `<`, `>`, or parentheses (a query string's `?`/`=` are fine inside the double quotes; drop `&`, which is a shell separator); `BASE` starts with `http://` or `https://` and contains none of the same characters. Anything else ends with "invalid argument format".

Baseline file key: the route becomes a slug by stripping the leading `/`, turning inner `/` into `-`, dropping the query string, and collapsing repeated or trailing `-`; the root route `/` becomes `root`. The viewport label is the one this run uses (`desktop` or `mobile`).

### Preflight

1. Capture backend: if `command -v playwright-cli` succeeds, use playwright-cli. Otherwise, if the session has playwright MCP tools (`mcp__playwright__*`), run the same procedure with them (navigate, accessibility snapshot, screenshot, comparison). With neither, print "no capture backend — install `npm i -g playwright-cli` or enable the playwright MCP (see `/oh-my-joy:setup`)" and stop.
2. Server up: if `curl -sf "$BASE" >/dev/null` fails, say "dev server not running — start it and rerun" and stop; nothing is auto-started.
3. If `.omj/fe-context.md` declares `verifySetup:`, `Read` that document and apply its auth-bypass or API-mock procedure before observing.

### Capture

Keep the session name `-s=omj`; with the MCP fallback, the browser tab takes the session's place.

```bash
playwright-cli -s=omj open "$BASE$ROUTE" --persistent
playwright-cli -s=omj goto "$BASE$ROUTE"
playwright-cli -s=omj snapshot      # structure (accessibility tree)
playwright-cli -s=omj screenshot    # visuals
```

- Auth redirects are only observable after the page opens, so handle them here: if navigation lands on a login page, re-login with `fill` and `click` using the `verifySetup` procedure or the exported `$JOY_TEST_EMAIL`/`$JOY_TEST_PASSWORD`, then `goto` again. With neither, say "route requires auth — log in manually in the browser and rerun". Pass credentials only as variable references, never resolved into commands, reports, or errors, and use test-only accounts; screenshots taken after login can contain session or personal data, so tell the user before persisting one as a baseline.
- Reached-route validation comes before any comparison: confirm from the snapshot that the page actually reached `"$ROUTE"`. A redirect elsewhere is reported as "expected route not reached (redirected)" and never compared — matching the wrong screen against the reference is this command's most dangerous silent failure.
- Baseline persistence: when the session context holds the Figma asset URL from a `/oh-my-joy:spec` spec, persist it:
  ```bash
  curl -f --remove-on-error --create-dirs -o ".omj/baselines/<route-slug>@<viewport>.png" "<asset-url>"
  ```
  `-f` stops a 403/404 body being saved as a PNG and `--remove-on-error` prevents 0-byte leftovers. On failure, advise "baseline expired (asset URLs last about 7 days) — rerun `/oh-my-joy:spec` to refresh" and continue. The URL source is the session context only.
- Comparison reference, in order: the Figma reference image from the immediately preceding `/oh-my-joy:spec` session context; otherwise a non-empty `.omj/baselines/<route-slug>@<viewport>.png`, `Read` and compared; otherwise inspect the route's own structure, accessibility, and layout without a forced comparison.
- Finish with `playwright-cli -s=omj close` (with the MCP fallback, close the tab).

### Output

Group differences by severity (🔴 🟡 🟢) as `element and position + observed difference + recommended fix`, prioritizing accessibility (alt, labels, touch targets) and token deviations (raw hex, per `figma-fidelity.md`). Suggest the next step: `/oh-my-joy:fix <route> "<complaint>"` for a visual defect, `/oh-my-joy:ship` when clean.

## Usage

<example>
```
/oh-my-joy:verify /settings/profile                 browser mode against the design/baseline
/oh-my-joy:verify / --base http://localhost:5173    another dev server port
/oh-my-joy:verify                                   evidence mode: run the project's verification commands
# auth routes: declare verifySetup in .omj/fe-context.md, or beforehand in the shell
#   export JOY_TEST_EMAIL=... JOY_TEST_PASSWORD=...
```
</example>

Add `.omj/baselines/` to the consuming project's `.gitignore`: it is a generated artifact, and post-login screenshots may contain personal data.
