# Separate before sharing

## When it applies

Several workers, modules, or processes would touch the same file, state, or resource.

## The rule

Remove the sharing first: give each part its own files, its own state, or a single owner of the shared piece. Coordinate only what is left after the split, because coordination is where conflicts and races live.

## What it changes

- Let two workers edit the same file and merge afterwards → split the work so each owns a different set of files.
- Guard a shared counter with locks in every caller → give the counter one owner that others ask.

## Not this

Duplicating data to avoid sharing it. Two copies of the same truth need syncing, which is sharing again.
