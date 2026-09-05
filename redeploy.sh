#!/bin/bash
set -euo pipefail

echo ""
echo "##################################################"
echo "#       WATANI FULL CLEAN REDEPLOY               #"
echo "##################################################"
echo ""

# ──────────────────────────────────────────────────────
# STEP 1: WIPE THE ENTIRE WATANI NAMESPACE
# Deletes all deployments, pods, services, ingresses,
# configmaps, secrets, AND the PVC so no volume lock
# is left behind from previous force-deleted pods.
# ──────────────────────────────────────────────────────
echo "=================================================="
echo " 1. Wiping Watani Namespace (full clean)"
echo "=================================================="

# Scale down deployments first to gracefully unmount PVC
sudo k3s kubectl scale deployment/watani-b2c-service --replicas=0 -n watani 2>/dev/null || true
sudo k3s kubectl scale deployment/watani-b2c-website --replicas=0 -n watani 2>/dev/null || true

# Wait for pods to terminate so the PVC is cleanly unmounted
echo "Waiting for pods to terminate..."
sudo k3s kubectl wait --for=delete pod -l app=watani-b2c-service -n watani --timeout=90s 2>/dev/null || true
sudo k3s kubectl wait --for=delete pod -l app=watani-b2c-website -n watani --timeout=60s 2>/dev/null || true

# Delete all workloads and config (keeps namespace itself)
sudo k3s kubectl delete deployment,service,ingress,configmap,secret,pvc \
    --all -n watani --grace-period=30 --timeout=120s 2>/dev/null || true

# Wait until ALL pods in namespace are gone (confirms PVC unmounted)
echo "Waiting for all pods to clear..."
sudo k3s kubectl wait --for=delete pod --all -n watani --timeout=120s 2>/dev/null || true

# Give local-path provisioner 5s to fully release the volume lock on disk
sleep 5
echo "Namespace wiped cleanly."

# ──────────────────────────────────────────────────────
# STEP 2: BUILD BACKEND IMAGE
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 2. Building Node.js Backend Image"
echo "=================================================="
docker build --no-cache -t watani-b2c-service:v1 ./watani-b2c-service
echo "Importing backend image into k3s containerd..."
docker save watani-b2c-service:v1 | sudo k3s ctr -n k8s.io images import -
echo "Backend image imported."

# ──────────────────────────────────────────────────────
# STEP 3: BUILD FRONTEND IMAGE
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 3. Building Next.js Website Image"
echo "=================================================="
docker build --no-cache -t watani-b2c-website:v1 ./watani-b2c-website
echo "Importing website image into k3s containerd..."
docker save watani-b2c-website:v1 | sudo k3s ctr -n k8s.io images import -
echo "Website image imported."

# ──────────────────────────────────────────────────────
# STEP 4: APPLY MANIFESTS (fresh namespace + all resources)
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 4. Applying Kubernetes Manifests"
echo "=================================================="

# Re-create namespace in case it was fully deleted
sudo k3s kubectl apply -f deploy/k8s/00-namespace.yaml

# Apply ConfigMap
sudo k3s kubectl apply -f deploy/k8s/01-backend-config.yaml

# Create DB credentials secret (idempotent)
echo "Applying watani-db-credentials Secret..."
sudo k3s kubectl create secret generic watani-db-credentials \
    --from-literal=SPRING_DATASOURCE_USERNAME=postgres \
    --from-literal=SPRING_DATASOURCE_PASSWORD=admin \
    --from-literal=JWT_SECRET="${JWT_SECRET:-watani-jwt-secret-$(openssl rand -hex 16)}" \
    -n watani --dry-run=client -o yaml | sudo k3s kubectl apply -f -

# Apply all workloads
sudo k3s kubectl apply -f deploy/k8s/02-backend.yaml
sudo k3s kubectl apply -f deploy/k8s/03-frontend.yaml
sudo k3s kubectl apply -f deploy/k8s/04-ingress.yaml

echo "All manifests applied."

# ──────────────────────────────────────────────────────
# STEP 5: WAIT FOR ROLLOUT
# Uses generous 300s since it's a fresh cold start on
# a 3.7 GB RAM single-node VPS.
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 5. Waiting for Services to Become Ready (5m max)"
echo "=================================================="

sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=300s
sudo k3s kubectl rollout status deployment/watani-b2c-website -n watani --timeout=300s

# ──────────────────────────────────────────────────────
# STEP 6: SYNC UPLOADED MEDIA ASSETS
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 6. Syncing Uploaded Media Assets"
echo "=================================================="

POD_NAME=$(sudo k3s kubectl get pod -n watani -l app=watani-b2c-service \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [ -n "$POD_NAME" ] && [ -d "watani-b2c-website/public/uploads" ]; then
    echo "Copying uploads into pod: $POD_NAME"
    sudo k3s kubectl exec -n watani "$POD_NAME" -- mkdir -p /app/uploads
    sudo k3s kubectl cp watani-b2c-website/public/uploads/. \
        "watani/$POD_NAME:/app/uploads/" || true
    echo "Media sync complete."
else
    echo "No uploads directory or pod not found - skipping media sync."
fi

# ──────────────────────────────────────────────────────
# DONE
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " Redeployment Complete! Live Cluster Status:"
echo "=================================================="
sudo k3s kubectl get pods -n watani -o wide
echo ""
echo "  Backend API : https://wataniandsons.ca/api/health"
echo "  Frontend    : https://wataniandsons.ca"
echo ""
