#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-service/." . \
  && git init -q -b main \
  && git add -A \
  && git -c user.name=eval -c user.email=eval@example.com commit -qm "feat: initial service" \
  && git checkout -q --detach \
  && printf '\nexport const shipped = true;\n' >> src/server.mjs
