#!/usr/bin/env bash
set -euo pipefail

echo "=== Linting lexicons ==="
goat lex lint

echo ""
echo "=== Checking DNS configuration ==="
goat lex check-dns
