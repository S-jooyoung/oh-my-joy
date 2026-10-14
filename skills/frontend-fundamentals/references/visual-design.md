# Visual design — the rubric for screens without a design reference

**Principle**: when no designer drew the screen, the model is the designer, and its defaults are the problem. A generated screen tends to reach for the same handful of patterns, so the rubric names those patterns as a closed list and asks for decisions in their place. `/oh-my-joy:ralplan` prescribes the decisions in a plan's Design direction, `/oh-my-joy:review` checks the code a diff adds, and `/oh-my-joy:verify` audits the rendered screen — one source of truth, three stages.

## Scope

The rubric applies to a screen no Figma design governs. With a Figma design, `figma-fidelity.md` is the authority and a rubric finding that conflicts with the design is only a 🟢 note for the designer, because the designer's decision outranks a generic pattern list. The objective defects below stay 🔴 even then: they are accessibility failures, not design choices.

## Design sources

Three sources can choose an element on purpose: the Figma design, the document the project declares as `designDocPath` in `.omj/fe-context.md`, and the approved plan's Design direction. A listed tell that one of them chose is not a finding; report it as a 🟢 note naming the source. This is how a tell is defined, so the design document settles a fact the definition relies on (did the project choose this element?) — it never switches off another review rule.

A design document a diff edits counts by its base wording, the text before the edit; a design document the diff adds settles nothing, because a change cannot choose its own exemption. `/oh-my-joy:review` judges that base wording; `/oh-my-joy:verify` has no diff and reads the working-tree document.

## Template tells

A closed list. "Seen in" says where each tell can be judged: `code` tells are visible in the diff, `render` tells only on the rendered screen.

| ID | Tell | Seen in |
| --- | --- | --- |
| T1 | A purple, violet, or indigo gradient as a page or section background, or a blue-to-purple color scheme | code, render |
| T2 | A symmetric three-column grid repeating icon, bold title, and one short line | code, render |
| T3 | Icons inside tinted circles used as section decoration | code, render |
| T4 | Every heading, paragraph, and card center-aligned | render |
| T5 | One large border radius applied to every element | render |
| T6 | Decorative blobs, floating circles, or wavy dividers filling empty space | code, render |
| T7 | Emoji used as icons, bullets, or design elements | code, render |
| T8 | A colored left border as the accent on cards | code, render |
| T9 | Generic hero copy — "Welcome to X", "Unlock the power of …", "Supercharge your …" — or the same phrasing in the page's language | code, render |
| T10 | Every section the same height and the same layout pattern in sequence | render |
| T11 | Identical rounded cards with a gradient wash as the default container | code, render |
| T12 | One word of a headline set in a different color or gradient | code, render |

A generic feel that matches no listed tell is a 🟡 judgment finding, never a 🔴: an open list would make the blocker a matter of taste. A system font stack is deliberately not on the list, since it is a legitimate choice for application UI.

### Severity scope

A listed tell is a 🔴 `template tell` finding when it sits inside the audit scope and no design source chose it. The audit scope is the new route or section an approved plan's Design direction covers (a plan without a Figma design, present in the session), or the whole page when `/oh-my-joy:verify` runs with `--design`.

A listed tell outside the audit scope is a 🟡 `template tell` finding and not a fix-loop target: a standalone review or verify cannot tell whether a designer or a brand chose it, and code the plan never touched is not this change's defect. The finding adds one line — declare a deliberate choice in `designDocPath` — so the next run reads it as chosen.

## Objective defects

These are 🔴 wherever they appear, because they are accessibility failures rather than taste:

- Text or control contrast below the AA ratios in `a11y.md` §3, measured against the first opaque ancestor background. Text over a gradient or an image cannot be measured this way; put it on a `Declined to judge` line.
- Horizontal scrolling at the mobile viewport.
- An interactive target smaller than the AA minimum in `a11y.md` §6. Inline text links inside a paragraph and targets meeting the spacing exception are not findings.
- A state the plan's States table or an acceptance criterion requires that renders blank or broken when reached.

## Judgment items

Report these at the severity given; they are judgments with reasons, not blockers.

- Hierarchy — 🟡 when the first viewport has no single focal point or competes between two primary actions, or when its order contradicts the plan's First viewport.
- Typography — 🟡 for more than two type families, sizes chosen ad hoc instead of from a scale, or body lines far beyond about 80 characters.
- Color — 🟡 for colors outside the token system, or meaning carried by color alone.
- Spacing and layout — 🟡 for spacing off the token scale, or images without dimensions that shift the layout as they load.
- Interaction states — 🟡 for a missing hover, `:focus-visible`, disabled, or loading style on an interactive element.
- Responsive — 🟡 when the tablet or mobile layout only shrinks the desktop one instead of reorganizing it.
- Motion — follow `a11y.md` §5.
- Content and copy — 🟡 for vague button labels and error messages without a next step.

Micro-typography and the full interaction checklist stay with the deep-audit route in `SKILL.md`; they are not copied here.

## Design direction

A plan without a Figma design that creates a new route or page, or a new full-width section of an existing page, writes a Design direction before its other frontend sections, which keep their names and order:

1. Context — the product, its users, and the primary job of this screen.
2. Token plan — the existing semantic tokens the screen uses. Where none fits, the plan uses the nearest existing semantic token by default and records the deviation; a new token is named as an open decision for the user, without a raw value, so the plan stays executable whichever way the user decides. The plan's Color / Tokens section maps components onto this plan.
3. First viewport — what the eye should land on first, second, and third.
4. States — a table `State | What the user sees | How to check` with loading, empty, error, and success rows. How to check names a component test, a `verifySetup` mock, or a browser capture, so every row can be proved.
5. Tell check — T1–T12 each with its one-line definition, marked avoided or with the source that chose it. Writing the definitions into the plan lets a reviewer that cannot read this file still judge the check.

Each States row becomes its own acceptance criterion that names its state, and one Tell check row becomes a criterion too: "none of the tells listed in this Design direction appears on <scope>, except those marked with their chosen source". Its How to check is a `/oh-my-joy:review` report with no 🔴 `template tell` and the browser capture of the `/oh-my-joy:verify` design audit.
