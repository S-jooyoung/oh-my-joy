#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cp -R "$ROOT/evals/fixtures/node-service/." .
cp "$ROOT/docs/EXECUTION-HANDOFF.md" workflow.md
