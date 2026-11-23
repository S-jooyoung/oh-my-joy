# Reporting

Every OMJ report that a person reads has one shape, so the reader finds the answer first, then their next step, then the detail. Command bodies name the five parts in one sentence and point here.

## The five parts

Write the parts in this order. The English names are the canonical names for authors; on screen, write each label in the user's language.

1. **Conclusion** — the outcome in one or two sentences: done, partly done, or blocked, and what the user now has.
2. **Your move** — what the user has to decide or do next, or that nothing is needed.
3. **What changed** — each change as before → after, in terms the user recognizes: a behavior, a screen, a file.
4. **Decisions made for you** — each choice made where the request was silent, with its reason and how to undo it. A temporary measure also states its reason, its limit, and the condition for removing it.
5. **How it was checked** — what ran, what it showed, and how strong that check is (below). End with one line that says where the evidence lives.

## Screens

| Screen | Shape |
| --- | --- |
| Approval screen | A card of at most 40 lines that carries the five parts as a proposal. Below it, a divider, then the detail the executor reads. |
| Completion report | At most 30 lines. |
| Review result shown to the user | The lead shortens each finding to at most three lines: what is wrong, where, and how to fix it. |
| Catch-up report | A summary of one to three sentences; each item as done, failed, in progress, or blocked; then what the user has to decide. An item still running is reported only as in progress. |

## Plain language

- Short declarative sentences.
- Explain a term in one phrase the first time it appears.
- Labels are in the user's language too; no fixed English labels.
- One name for one thing, every time.

## What stays out of the body

Hashes, fingerprints, lists of command arguments, and full paths of evidence files stay out of the report body. One line at the end says where the evidence is.

## Claims and check strength

Mark each claim as measured (you ran it), inferred (it follows from what you read), or guessed (it is plausible but unchecked).

Check strength, strongest first:

1. Ran in the real app
2. Ran the tests
3. Type check or build only
4. Read the code only

A claim with no evidence file is `not confirmed`. Use no word stronger than the evidence: "works" needs one of the first two strengths, and a claim that rests on reading the code is inferred.

## Progress line

When a goal finishes, print one line: `<done>/<total> done: <goal>. Next: <goal>`.

## Citing principles

When a [principle](principles/INDEX.md) changed a decision, name the principle and state the decision in one phrase. Cite only detail files read in this session.

## Simpler, please

When the user asks for simpler words, say it again in plainer words without dropping a single fact or number. Make a shareable page only when the user asks for one.

## Examples

<example>
Done: the signup form now rejects an email address without a domain.

Your move: nothing. Merge when you are ready.

What changed:
- Typing "ana@" on the signup form: accepted, then refused by the server with a generic error → refused on the form with "Enter a full email address".

Decisions made for you:
- The check lives in the form only, because the server already validates on save. To undo it, delete `validateEmail` in `SignupForm.tsx`.

How it was checked:
- Ran in the real app: submitted "ana@" and "ana@example.com" on the signup page (measured).
- Ran the tests: the form tests pass, including a new one that failed before the fix (measured).

Evidence: the run's evidence folder under `.omj/goals/signup-email/`.
</example>

<example>
2/3 done: email check on the signup form. Next: the same check on the profile form.

Subtract before you add: removed the unused `strictEmail` flag instead of adding a second one.
</example>
