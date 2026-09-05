#!/bin/bash
# Full release - builds, ships, and rolls out all 3 modules.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy/lib.sh"

preflight_check
deploy_backend
deploy_frontend
deploy_amanat

echo "Deployment successful. Tag: $TAG"
