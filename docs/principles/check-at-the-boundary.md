# Check at the boundary

## When it applies

Data enters from outside the code you control: user input, a file, the network, an environment variable, another process.

## The rule

Validate it where it enters, once, and turn it into a trusted value. Code past the boundary relies on that value instead of re-checking it at every use.

## What it changes

- Check for a missing field in five functions → parse the request once and reject it at the entry point.
- Trust a config file as written → validate it on load and fail with a clear message.

## Not this

Dropping checks inside the boundary that protect a real invariant. Remove repeated input checks, not assertions about internal state.
