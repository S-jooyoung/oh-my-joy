# Investigation

## When it applies

The user asks how something works, why something happened, or where something lives, and asks for no change.

## Steps

1. Restate the question in one sentence. Check: the code or the records can answer it.
2. Answer from the code and the records: source, logs, history, documents. Edit no file. Check: `git status` shows no change of yours.
3. Mark each claim as measured, inferred, or guessed. Check: every claim has a mark and a source.
4. When a cheap, safe run would turn an inference into a measurement, run it. Check: the run and its result are recorded.

## Principles to read

- [Question the premise](../principles/question-the-premise.md)
- [Try it instead of asking](../principles/try-it-instead-of-asking.md)
- [Say how sure](../principles/say-how-sure.md)
- [Explain the number](../principles/explain-the-number.md)
- [Guard the context](../principles/guard-the-context.md)
- [Reader first](../principles/reader-first.md)

## Review

None. An investigation changes no file, so there is nothing to review. When the answer shows that a change is needed, report it; the change runs under another playbook.

## Report

Give the answer first, then how it works, then where it lives (`file:line`), then the caveats. Mark claims as [REPORTING.md](../REPORTING.md) describes.
