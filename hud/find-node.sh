#!/bin/sh
# OMJ Node.js Finder (find-node.sh) — vendored from oh-my-claudecode (MIT)
#
# Locates the Node.js binary and executes it with the provided arguments.
# Designed for nvm/fnm users where `node` is not on PATH in non-interactive
# shells (e.g. Claude Code hook invocations).
#
# Priority:
#   1. `which node` (node is on PATH)
#   2. nvm versioned paths  (~/.nvm/versions/node/*/bin/node)
#   3. fnm versioned paths and aliases
#   4. volta/asdf/nodenv shims
#   5. Homebrew / system paths (/opt/homebrew/bin/node, /usr/local/bin/node)
#
# Exits 0 on failure so it never blocks Claude Code hook processing.

NODE_BIN=""
DEFERRED_NODE_BIN=""

case "$0" in
  */*)
    SCRIPT_DIR="${0%/*}"
    ;;
  *)
    SCRIPT_DIR='.'
    ;;
esac

SCRIPT_DIR="$(cd "$SCRIPT_DIR" && pwd)"

# ---------------------------------------------------------------------------
# 1. which node
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  _resolved=$(command -v node 2>/dev/null)
  if [ -n "$_resolved" ]; then
    case "$_resolved" in
      "$HOME/.volta/bin/node"|"$HOME/.asdf/shims/node"|"$HOME/.nodenv/shims/node")
        DEFERRED_NODE_BIN="$_resolved"
        ;;
      *)
        NODE_BIN="$_resolved"
        ;;
    esac
  fi
fi

# ---------------------------------------------------------------------------
# 2. nvm versioned paths: iterate to find the latest installed version
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  # shellcheck disable=SC2231
  for _path in "$HOME/.nvm/versions/node/"*/bin/node; do
    [ -x "$_path" ] && NODE_BIN="$_path"
    # Keep iterating — later entries tend to be newer (lexicographic order)
  done
fi

# ---------------------------------------------------------------------------
# 3. fnm versioned paths and aliases (Linux and macOS default locations)
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  for _path in \
    "$HOME/.fnm/aliases/default/bin/node" \
    "$HOME/.local/share/fnm/aliases/default/bin/node" \
    "$HOME/Library/Application Support/fnm/aliases/default/bin/node"; do
    if [ -x "$_path" ]; then
      NODE_BIN="$_path"
      break
    fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  for _fnm_base in \
    "$HOME/.fnm/node-versions" \
    "$HOME/Library/Application Support/fnm/node-versions" \
    "$HOME/.local/share/fnm/node-versions"; do
    if [ -d "$_fnm_base" ]; then
      # shellcheck disable=SC2231
      for _path in "$_fnm_base/"*/installation/bin/node; do
        [ -x "$_path" ] && NODE_BIN="$_path"
      done
      [ -n "$NODE_BIN" ] && break
    fi
  done
fi

# ---------------------------------------------------------------------------
# 4. Common version-manager shims that do not require shell init files
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ] && [ -n "$DEFERRED_NODE_BIN" ]; then
  NODE_BIN="$DEFERRED_NODE_BIN"
fi

if [ -z "$NODE_BIN" ]; then
  for _path in \
    "$HOME/.volta/bin/node" \
    "$HOME/.asdf/shims/node" \
    "$HOME/.nodenv/shims/node"; do
    if [ -x "$_path" ]; then
      NODE_BIN="$_path"
      break
    fi
  done
fi

# ---------------------------------------------------------------------------
# 5. Common Homebrew / system paths
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  for _path in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$_path" ]; then
      NODE_BIN="$_path"
      break
    fi
  done
fi

# ---------------------------------------------------------------------------
# Invoke node with all provided arguments
# ---------------------------------------------------------------------------
if [ -z "$NODE_BIN" ]; then
  printf '[OMJ] Error: Could not find node binary. Install Node.js or put it on PATH.\n' >&2
  exit 0  # exit 0 so this hook does not block Claude Code
fi

exec "$NODE_BIN" "$@"
