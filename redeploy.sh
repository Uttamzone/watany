#!/bin/bash
set -euo pipefail

echo ""
echo "##################################################"
echo "#       WATANI FULL CLEAN REDEPLOY               #"
echo "##################################################"
echo ""

# ──────────────────────────────────────────────────────
# STEP 1: WIPE WATANI NAMESPACE
# Scale-down first so PVC is cleanly unmounted.
# ──────────────────────────────────────────────────────
echo "=================================================="
echo " 1. Wiping Watani Namespace (clean slate)"
echo "=================================================="

sudo k3s kubectl scale deployment/watani-b2c-service --replicas=0 -n watani 2>/dev/null || true
sudo k3s kubectl scale deployment/watani-b2c-website --replicas=0 -n watani 2>/dev/null || true

echo "Waiting for pods to terminate cleanly..."
sudo k3s kubectl wait --for=delete pod -l app=watani-b2c-service -n watani --timeout=90s 2>/dev/null || true
sudo k3s kubectl wait --for=delete pod -l app=watani-b2c-website -n watani --timeout=60s 2>/dev/null || true

# Delete all resources (PVC included to release volume lock)
sudo k3s kubectl delete deployment,service,ingress,configmap,secret,pvc \
    --all -n watani --grace-period=15 --timeout=90s 2>/dev/null || true

sudo k3s kubectl wait --for=delete pod --all -n watani --timeout=90s 2>/dev/null || true

# Give local-path provisioner time to fully release the volume
sleep 5
echo "Namespace wiped."

# ──────────────────────────────────────────────────────
# STEP 2: BUILD BACKEND IMAGE
# No --no-cache: reuses npm install layer (much faster on
# a slow VPS). Changed source files always bust the cache.
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 2. Building Node.js Backend Image"
echo "=================================================="
docker build -t watani-b2c-service:v1 ./watani-b2c-service
echo "Importing backend image into k3s containerd..."
sudo k3s ctr -n k8s.io images rm docker.io/library/watani-b2c-service:v1 2>/dev/null || true
docker save watani-b2c-service:v1 | sudo k3s ctr -n k8s.io images import -
echo "Backend image ready."

# ──────────────────────────────────────────────────────
# STEP 3: BUILD FRONTEND IMAGE
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 3. Building Next.js Website Image"
echo "=================================================="
docker build -t watani-b2c-website:v1 ./watani-b2c-website
echo "Importing website image into k3s containerd..."
sudo k3s ctr -n k8s.io images rm docker.io/library/watani-b2c-website:v1 2>/dev/null || true
docker save watani-b2c-website:v1 | sudo k3s ctr -n k8s.io images import -
echo "Website image ready."

# Verify images are visible in containerd
echo ""
echo "Images in containerd:"
sudo k3s ctr -n k8s.io images ls | grep -E 'watani-b2c-(service|website)' || echo "WARNING: images not found!"

# ──────────────────────────────────────────────────────
# STEP 4: APPLY MANIFESTS
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 4. Applying Kubernetes Manifests"
echo "=================================================="

sudo k3s kubectl apply -f deploy/k8s/00-namespace.yaml
sudo k3s kubectl apply -f deploy/k8s/01-backend-config.yaml

echo "Creating watani-db-credentials Secret..."
sudo k3s kubectl create secret generic watani-db-credentials \
    --from-literal=SPRING_DATASOURCE_USERNAME=postgres \
    --from-literal=SPRING_DATASOURCE_PASSWORD=admin \
    --from-literal=JWT_SECRET="${JWT_SECRET:-watani-jwt-$(openssl rand -hex 16)}" \
    -n watani --dry-run=client -o yaml | sudo k3s kubectl apply -f -

sudo k3s kubectl apply -f deploy/k8s/02-backend.yaml
sudo k3s kubectl apply -f deploy/k8s/03-frontend.yaml
sudo k3s kubectl apply -f deploy/k8s/04-ingress.yaml

echo "All manifests applied."

# ──────────────────────────────────────────────────────
# STEP 5: WAIT FOR PODS WITH LIVE DIAGNOSTICS
# Polls every 15s for up to 10 minutes, printing pod
# status and container logs so you can see what's wrong.
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " 5. Waiting for Pods to Become Ready (10m max)"
echo "=================================================="

READY=false
DEADLINE=600   # 10 minutes
INTERVAL=15
ELAPSED=0

while [ $ELAPSED -lt $DEADLINE ]; do
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))

    echo ""
    echo "── Pod Status at ${ELAPSED}s / ${DEADLINE}s ──────────────"
    sudo k3s kubectl get pods -n watani -o wide 2>/dev/null || true

    # Check if both deployments are fully available
    BACKEND_READY=$(sudo k3s kubectl get deployment watani-b2c-service -n watani \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    FRONTEND_READY=$(sudo k3s kubectl get deployment watani-b2c-website -n watani \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

    echo "  Backend ready replicas : ${BACKEND_READY:-0}/1"
    echo "  Frontend ready replicas: ${FRONTEND_READY:-0}/1"

    if [ "${BACKEND_READY:-0}" = "1" ] && [ "${FRONTEND_READY:-0}" = "1" ]; then
        READY=true
        break
    fi

    # Show events and logs for any unready pod (e.g. 0/1, CrashLoopBackOff, Pending)
    UNREADY_PODS=$(sudo k3s kubectl get pods -n watani --no-headers 2>/dev/null | awk '{split($2, a, "/"); if (a[1] != a[2] || a[1] == "0") print $1}' || true)

    if [ -n "$UNREADY_PODS" ]; then
        for POD in $UNREADY_PODS; do
            echo ""
            echo "  [Unready Pod: $POD]"
            echo "  Recent Events:"
            sudo k3s kubectl describe pod "$POD" -n watani 2>/dev/null \
                | grep -A 8 "Events:" | tail -8 || true
            echo "  Last 20 log lines:"
            sudo k3s kubectl logs "$POD" -n watani --tail=20 2>/dev/null \
                | sed 's/^/    /' || true
        done
    fi
done

if [ "$READY" = true ]; then
    echo ""
    echo "✓ Both deployments are ready!"
else
    echo ""
    echo "✗ Timed out waiting for deployments. Showing full diagnostics:"
    echo ""
    echo "── Final Pod State ──────────────────────────────"
    sudo k3s kubectl get pods -n watani -o wide || true
    echo ""
    echo "── Backend Events ───────────────────────────────"
    sudo k3s kubectl describe deployment watani-b2c-service -n watani 2>/dev/null | tail -20 || true
    echo ""
    echo "── Backend Logs ─────────────────────────────────"
    sudo k3s kubectl logs -l app=watani-b2c-service -n watani --tail=50 2>/dev/null || true
    echo ""
    echo "── Frontend Events ──────────────────────────────"
    sudo k3s kubectl describe deployment watani-b2c-website -n watani 2>/dev/null | tail -20 || true
    echo ""
    echo "── Frontend Logs ────────────────────────────────"
    sudo k3s kubectl logs -l app=watani-b2c-website -n watani --tail=50 2>/dev/null || true
    echo ""
    echo "── Node Resources ───────────────────────────────"
    free -h || true
    df -h / || true
    exit 1
fi

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
fi

# ──────────────────────────────────────────────────────
# DONE
# ──────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo " Redeployment Complete!"
echo "=================================================="
sudo k3s kubectl get pods -n watani -o wide
echo ""
echo "  Backend API : https://wataniandsons.ca/api/health"
echo "  Frontend    : https://wataniandsons.ca"
echo ""
