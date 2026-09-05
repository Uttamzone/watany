#!/bin/bash
set -euo pipefail

echo "=================================================="
echo " Fresh Scratch Deployment on Hetzner VPS"
echo "=================================================="

cd /root/watany
git pull origin main

echo "1. Wiping & Granting PostgreSQL Schema Permissions..."
sudo -u postgres psql -d watani_b2c -c "
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA public TO postgres;
" || true

echo "2. Recreating Kubernetes Resources..."
sudo k3s kubectl apply -f deploy/k8s/00-namespace.yaml
sudo k3s kubectl apply -f deploy/k8s/01-backend-config.yaml
sudo k3s kubectl apply -f deploy/k8s/02-backend.yaml
sudo k3s kubectl apply -f deploy/k8s/03-frontend.yaml
sudo k3s kubectl apply -f deploy/k8s/04-ingress.yaml

echo "3. Building Backend Image (watani-b2c-service)..."
docker build -t watani-b2c-service:v1 ./watani-b2c-service
docker save watani-b2c-service:v1 -o img-backend.tar
sudo k3s ctr -n k8s.io images import img-backend.tar
rm img-backend.tar

echo "4. Building Website Image (watani-b2c-website)..."
docker build -t watani-b2c-website:v1 ./watani-b2c-website
docker save watani-b2c-website:v1 -o img-website.tar
sudo k3s ctr -n k8s.io images import img-website.tar
rm img-website.tar

echo "5. Restarting Pods..."
sudo k3s kubectl delete pod -n watani --all --grace-period=0 --force || true

echo "6. Syncing Uploaded Media Assets..."
echo "Waiting for watani-b2c-service pod to start running..."
for i in {1..30}; do
    POD_NAME=$(sudo k3s kubectl get pod -n watani -l app=watani-b2c-service --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [ -n "$POD_NAME" ]; then
        echo "Found running pod: $POD_NAME. Syncing images..."
        sudo k3s kubectl cp /root/watany/watani-b2c-website/public/uploads "watani/$POD_NAME:/app/" || true
        echo "Media asset sync completed!"
        break
    fi
    sleep 3
done

echo ""
echo "=================================================="
echo " Fresh Deployment Complete!"
echo " Both Backend and Website are freshly deployed."
echo "=================================================="
