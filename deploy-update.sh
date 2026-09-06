#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo " Executing Live Deployment Update (deploy-live.sh)"
echo "=================================================="

exec bash "$SCRIPT_DIR/deploy-live.sh" "$@"
