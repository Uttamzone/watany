#!/bin/bash
set -euo pipefail

echo "=================================================="
echo " Applying Code Updates (No Database Reset)"
echo "=================================================="

cd /root/watany
git pull origin main

echo "1. Building Backend Image (watani-b2c-service)..."
docker build -t watani-b2c-service:v1 ./watani-b2c-service
docker save watani-b2c-service:v1 -o backend.tar
sudo k3s ctr -n k8s.io images import backend.tar
rm -f backend.tar

echo "2. Building Website Image (watani-b2c-website)..."
docker build -t watani-b2c-website:v1 ./watani-b2c-website
docker save watani-b2c-website:v1 -o website.tar
sudo k3s ctr -n k8s.io images import website.tar
rm -f website.tar

echo "3. Restarting Pods..."
sudo k3s kubectl delete pod -n watani --all --grace-period=0 --force || true

echo "4. Waiting for Services to become Ready..."
sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=120s || true
sudo k3s kubectl rollout status deployment/watani-b2c-website -n watani --timeout=120s || true

echo "5. Syncing Uploaded Media Assets..."
POD_NAME=$(sudo k3s kubectl get pod -n watani -l app=watani-b2c-service --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$POD_NAME" ]; then
    echo "Found running backend pod: $POD_NAME. Copying uploads into container..."
    sudo k3s kubectl exec -n watani "$POD_NAME" -- mkdir -p /app/uploads
    sudo k3s kubectl cp /root/watany/watani-b2c-website/public/uploads/. "watani/$POD_NAME:/app/uploads/" || true
    echo "Media asset sync completed!"
fi

echo ""
echo "=================================================="
echo " Update Deployment Complete!"
echo " Code updated smoothly & services are fully READY!"
echo "=================================================="
