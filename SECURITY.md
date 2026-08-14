# Security policy

## Supported versions

oh-my-joy is maintained by one person, and only the latest released version receives fixes. Update with `/plugin update oh-my-joy` followed by `/reload-plugins` before reporting anything.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting instead: [**Report a vulnerability**](https://github.com/S-jooyoung/oh-my-joy/security/advisories/new). If that form is unavailable to you, email <jooyoung.dev@gmail.com> with `[security]` in the subject.

Please include the plugin version, the command or agent involved, and the steps to reproduce. A proof-of-concept that shows the unintended effect is more useful than a description of the risk.

Expect a first response within about a week. This is a personal project without an on-call rotation, so there is no faster guarantee — if the issue is being actively exploited, say so in the first line.

## What counts as a vulnerability here

This plugin ships **no runtime code that executes on its own**. It is Markdown prompts, three agent definitions, two opt-in hook scripts, and two Node scripts run explicitly by the user. The security surface is therefore narrower than a typical package, and it is worth stating where it actually lies:

**In scope**

- A command whose `allowed-tools` pre-approves an action its body does not need — over-broad permission grants are the main risk class in a plugin like this, because a pre-approved tool bypasses the prompt the user would otherwise see.
- Prompt content that could steer Claude into destructive or exfiltrating actions (deleting files, pushing to remotes, sending data to a third party) without the user's confirmation.
- Command injection in `scripts/*.mjs` or `templates/hooks/*.mjs` — particularly unquoted interpolation of a path or branch name into a shell invocation.
- A hook that writes outside the consuming project, or that fails in a way that is not "no-op, exit 0".
- Path traversal in `scripts/goal-state.mjs` (`--slug`, `--brief-file`) letting state escape `.omj/goals/`.

**Out of scope**

- The permission prompt itself. Several commands deliberately *do not* pre-approve dangerous execution so the prompt becomes the user's confirmation point. Being asked to approve a command is the design, not a bug.
- Vulnerabilities in Claude Code, Figma MCP, Context7, or playwright — report those to their own maintainers.
- Anything requiring the attacker to already control the user's machine or their `~/.claude` directory.

## Disclosure

Report privately, and give me a chance to ship a fix before publishing. I will credit you in the CHANGELOG entry unless you prefer otherwise.
