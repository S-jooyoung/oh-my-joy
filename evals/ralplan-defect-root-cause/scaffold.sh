#!/usr/bin/env bash
set -euo pipefail
FIXTURES="$(cd "$(dirname "${BASH_SOURCE[0]}")/../fixtures" && pwd)"
cp -R "$FIXTURES/node-defect/." . \
  && git init -q \
  && git add -A \
  && git -c user.name=eval -c user.email=eval@example.com commit -qm init
