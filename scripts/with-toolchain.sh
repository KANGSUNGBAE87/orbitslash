#!/bin/sh
# Project-local toolchain selection; never changes the user's shell or Hermes runtime.
set -eu
cd "$(dirname "$0")/.."
if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)" != "24" ]; then
  for node_bin in /opt/homebrew/opt/node@24/bin /usr/local/opt/node@24/bin; do
    if [ -x "$node_bin/node" ]; then
      PATH="$node_bin:$PATH"
      export PATH
      break
    fi
  done
fi
if [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)" != "24" ]; then
  echo 'Node 24 required. Use nvm use or install node@24 before running this command.' >&2
  exit 2
fi
if [ "$#" -eq 0 ]; then
  echo 'Usage: sh scripts/with-toolchain.sh npm run dev|build|preflight:release' >&2
  exit 2
fi
exec "$@"
