#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-service-failing/." .
node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.scripts.lint="node --check src/server.mjs";fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
mkdir -p .omj
printf 'verifyCommands:\n  - npm test\n  - npm run lint\n' > .omj/fe-context.md
