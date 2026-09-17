#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-service/." . \
  && git init -q \
  && git checkout -q -b feature/health-status \
  && git add -A \
  && git -c user.name=eval -c user.email=eval@example.com commit -qm "feat: initial service" \
  && printf '\nexport const healthStatusAligned = true;\n' >> src/server.mjs
