---
type: llm
---
The reply flags the caller in src/profile.mjs, a file the change does not touch: `profileName` reads `getUser(id).name`, which is now a property of a Promise because `getUser` in src/users.mjs became async. It cites a src/profile.mjs location.
