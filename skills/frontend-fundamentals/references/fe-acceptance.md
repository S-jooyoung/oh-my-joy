# Project acceptance axes — the *mechanism* that forces frequently missed items into specs

The FF 4 criteria + accessibility + responsiveness/tokens are universal to **every** project (already covered by the other `references/*` and `commands/omj.md` Phase 2). But **the omissions that cause rework** usually come from *that project's own* special conditions — e.g. parallel locales, theme/brand modes, currency/format rules, specific device priorities. These differ per project, so **the plugin must not force any particular axis** (it would be false for other repos and other users).

> **Principle: OMJ does *not force acceptance axes as built-ins.*** It **provides only the mechanism** (examples given, never shipped as defaults); what to check is declared by each project. That is what makes it work universally — company repos, personal projects, third-party open-source use alike.

## Behavior

1. If the repo root has **`.omj/fe-context.md`** → read the acceptance axes declared there and include them in `/omj` spec acceptance criteria + `/omj-fix` diagnostic checks + `design-qa` conditional items (Story·i18n). If `contextDocs:` is declared, Read those documents too and fold them into the same places (adopting existing rule documents — never duplicating content into fe-context), and use the `decisions:` list as a recurrence-prevention check.
2. If absent → apply only the universal FF criteria (readability, predictability, cohesion, coupling, accessibility + responsiveness/tokens) (graceful — not an error).
3. **The scaffolding entry point is `/omj-setup`** — when the file is missing, setup proposes creating it, and detected candidates (i18n directories, token systems, theme classes) are recorded **as comments only** (no auto-declared axes).

## Token-system detection order (SoT — referenced by `/omj` Color/Tokens, `/omj-setup`, `/omj-sync`)

1. The `tokensPath:` declaration in `.omj/fe-context.md` (`.json` = DTCG, `.css` = CSS custom properties)
2. The conventional path `shared/tokens/tokens.json` (when present)
3. Tailwind config — theme extensions in `tailwind.config.*`, or Tailwind v4 `@utility`/`@theme` CSS definitions
4. Global CSS custom properties (files defining `:root { --* }`)

Whichever tier it is found at, **mapping to that system's semantic classes/variables is the spec's obligation** — the absence of tokens.json is no license for raw hex/px. (Only `/omj-sync`'s sync/push/extract require a file-based token store (tiers 1·2 or `.css`).)

## `.omj/fe-context.md` format (written by the project — **not shipped with the plugin**)

```
tokensPath: <semantic token file path>   # optional (.json=DTCG, .css=custom properties)
designDocPath: <brand/composition rules doc>   # optional — when declared, /omj Phase 1 Reads it
storybook: true|false                  # optional — true activates design-qa Story checks + the check-story-exists hook
storiesDir: <Story collection directory>        # optional — only for projects keeping Stories in a separate directory instead of sibling files
verifySetup: <visual-verification procedure doc/section>     # optional — /omj-verify·/omj-fix Read before observing (auth bypass/API mocks: cookie injection, guard mocking, …. Whatever the procedure, verify always validates the reached route before capture)
conventions:                           # optional — project code-structure declarations (e.g. 1 component = 4 files)
  - <rule 1>
acceptance:                            # optional — one line per axis this project frequently misses during implementation
  - <axis 1>
  - <axis 2>
contextDocs:                           # optional — adopt existing project rule documents as they are (no content duplication)
  - AGENTS.md                          #   /omj·/oh-my-joy:ff-review·design-qa Read them together — never creating a duplicate SoT
  - .claude/rules/components.md
decisions:                             # optional — one line per recurrence-prevention decision/ADR (lets specs/reviews catch relapses of past decisions)
  - <decision ID or one-line rule>
```

**Example (purely *that project's* declaration, never an OMJ default):**

```
tokensPath: src/tokens/colors.css
storybook: true
verifySetup: docs/VERIFY-SETUP.md
acceptance:
  - update all supported locales simultaneously (0 missing message keys; currency/line breaks per locale)
  - check per-route theme/brand mode tokens
  - check mobile and desktop together
```

A single-locale, single-theme personal project can leave `acceptance:` empty or omit the file entirely — then only the universal FF criteria apply. In other words, **what to enforce is 100% the project's choice**; the plugin merely reads the declaration and folds it into specs.
