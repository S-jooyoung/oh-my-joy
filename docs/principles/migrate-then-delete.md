# Migrate then delete

## When it applies

A new path replaces an old one: a renamed function, a new API, a moved file, a new data format.

## The rule

Move every caller to the new path and delete the old one in the same change. Two live paths double the maintenance and let new callers pick the wrong one.

## What it changes

- Add the new function and leave the old one for later → switch every caller and remove the old function now.
- Keep both the old and new config keys working → migrate the stored values and drop the old key.

## Not this

Breaking an external contract without notice. When callers outside the repository depend on the old path, keep it for a stated period and say when it goes.
