#!/usr/bin/env bash
set -euo pipefail

UPDATE_FLAG=""
if [ "${1:-}" = "--update" ]; then
  UPDATE_FLAG="--update"
fi

echo "=== Publishing lexicons ==="
echo "Using: goat lex publish $UPDATE_FLAG"
echo ""
echo "Credentials from ATP_USERNAME / ATP_PASSWORD env vars,"
echo "or from an active 'goat account login' session."
echo ""

goat lex publish $UPDATE_FLAG
