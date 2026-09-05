#!/bin/bash
set -euo pipefail

echo "=================================================="
echo " 1. Clearing Old Deployments & Pods"
echo "=================================================="
sudo k3s kubectl delete deployment watani-b2c-service watani-b2c-website -n watani --ignore-not-found=true
sudo k3s kubectl delete pod -n watani --all --grace-period=0 --force || true

echo "=================================================="
echo " 2. Building Node.js Backend Image"
echo "=================================================="
docker build -t watani-b2c-service:v1 ./watani-b2c-service
docker save watani-b2c-service:v1 -o backend.tar
sudo k3s ctr -n k8s.io images import backend.tar
rm -f backend.tar

echo "=================================================="
echo " 3. Building Next.js Website Image"
echo "=================================================="
docker build -t watani-b2c-website:v1 ./watani-b2c-website
docker save watani-b2c-website:v1 -o website.tar
sudo k3s ctr -n k8s.io images import website.tar
rm -f website.tar

echo "=================================================="
echo " 4. Applying Manifests (/api/health Probe)"
echo "=================================================="
sudo k3s kubectl apply -f deploy/k8s/00-namespace.yaml
sudo k3s kubectl apply -f deploy/k8s/01-backend-config.yaml
sudo k3s kubectl apply -f deploy/k8s/02-backend.yaml
sudo k3s kubectl apply -f deploy/k8s/03-frontend.yaml
sudo k3s kubectl apply -f deploy/k8s/04-ingress.yaml

echo "=================================================="
echo " 5. Waiting for Services to become Ready"
echo "=================================================="
sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=120s
sudo k3s kubectl rollout status deployment/watani-b2c-website -n watani --timeout=120s

echo "=================================================="
echo " 6. Syncing Uploaded Media Assets"
echo "=================================================="
POD_NAME=$(sudo k3s kubectl get pod -n watani -l app=watani-b2c-service --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$POD_NAME" ] && [ -d "watani-b2c-website/public/uploads" ]; then
    echo "Found running backend pod: $POD_NAME. Copying uploads..."
    sudo k3s kubectl exec -n watani "$POD_NAME" -- mkdir -p /app/uploads
    sudo k3s kubectl cp watani-b2c-website/public/uploads/. "watani/$POD_NAME:/app/uploads/" || true
    echo "Media sync complete!"
fi

echo "=================================================="
echo " Redeployment Complete! Live Pods:"
echo "=================================================="
sudo k3s kubectl get pods -n watani
