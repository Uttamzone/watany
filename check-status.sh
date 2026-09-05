#!/bin/bash
set -euo pipefail

echo "=================================================="
echo " Checking Watani B2C Kubernetes Cluster Status"
echo "=================================================="

sudo k3s kubectl get pods -n watani

echo ""
echo "==> Backend Logs (watani-b2c-service):"
sudo k3s kubectl logs -n watani deployment/watani-b2c-service --tail=20 || true

echo ""
echo "==> Website Logs (watani-b2c-website):"
sudo k3s kubectl logs -n watani deployment/watani-b2c-website --tail=10 || true
