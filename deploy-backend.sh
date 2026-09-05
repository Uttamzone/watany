#!/bin/bash
# Partial release - watani-b2c-service only.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy/lib.sh"

preflight_check
deploy_backend

echo "Deployment successful. Tag: $TAG"
