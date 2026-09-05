# Shared by deploy-all.sh / deploy-backend.sh / deploy-frontend.sh / deploy-amanat.sh.
# Not runnable on its own - sourced, not executed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DEPLOY="$SCRIPT_DIR/.env.deploy"

if [ ! -f "$ENV_DEPLOY" ]; then
  echo "Missing $ENV_DEPLOY. Copy .env.deploy.example to .env.deploy and fill it in."
  exit 1
fi
set -a
source "$ENV_DEPLOY"
set +a

: "${REMOTE_USER:?Set REMOTE_USER in .env.deploy}"
: "${REMOTE_HOST:?Set REMOTE_HOST in .env.deploy}"
: "${SSH_KEY:?Set SSH_KEY in .env.deploy}"
: "${NEXT_PUBLIC_API_BASE_URL:?Set NEXT_PUBLIC_API_BASE_URL in .env.deploy}"
: "${NEXT_PUBLIC_SITE_URL:?Set NEXT_PUBLIC_SITE_URL in .env.deploy}"

TAG="$(date +%Y%m%d%H%M%S)"
REMOTE="$REMOTE_USER@$REMOTE_HOST"
SSH="ssh -i $SSH_KEY -o BatchMode=yes $REMOTE"

# Aborts before building anything if k3s/PostgreSQL/cert-manager aren't healthy.
preflight_check() {
  echo "==> Health-checking server prerequisites ($REMOTE_HOST)"

  local out
  out="$($SSH bash -s <<'REMOTE'
set -u
echo "NODE_READY=$(sudo k3s kubectl get nodes --no-headers 2>/dev/null | awk '$2=="Ready"{c++} END{print c+0}')"
echo "PG_ACTIVE=$(systemctl is-active postgresql@18-main 2>/dev/null || echo inactive)"
echo "CERTMGR_NOT_RUNNING=$(sudo k3s kubectl get pods -n cert-manager --no-headers 2>/dev/null | grep -vc ' Running ')"
echo "CERT_READY=$(sudo k3s kubectl get certificate watani-tls -n watani -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)"
REMOTE
)" || { echo "!! Could not reach $REMOTE_HOST over SSH - aborting"; exit 1; }

  local node_ready pg_active certmgr_not_running cert_ready failed=0
  node_ready="$(awk -F= '/^NODE_READY=/{print $2}' <<<"$out")"
  pg_active="$(awk -F= '/^PG_ACTIVE=/{print $2}' <<<"$out")"
  certmgr_not_running="$(awk -F= '/^CERTMGR_NOT_RUNNING=/{print $2}' <<<"$out")"
  cert_ready="$(awk -F= '/^CERT_READY=/{print $2}' <<<"$out")"

  report() {
    if [ "$2" = "1" ]; then echo "   OK    $1"; else echo "   FAIL  $1"; failed=1; fi
  }

  report "k3s cluster (node Ready)" "$([ "${node_ready:-0}" -ge 1 ] 2>/dev/null && echo 1 || echo 0)"
  report "PostgreSQL (postgresql@18-main)" "$([ "$pg_active" = "active" ] && echo 1 || echo 0)"
  report "cert-manager pods Running" "$([ "${certmgr_not_running:-1}" = "0" ] && echo 1 || echo 0)"
  report "TLS certificate (watani-tls) Ready" "$([ "$cert_ready" = "True" ] && echo 1 || echo 0)"

  if [ "$failed" -ne 0 ]; then
    echo "!! One or more health checks failed - aborting deploy without touching workloads."
    exit 1
  fi
  echo "==> All health checks passed"
}

# Keeps only the 3 newest timestamped image tags for $1, removing older ones.
prune_old_images() {
  local repo="$1"
  $SSH "sudo k3s ctr images ls -q \
          | grep -E '^docker.io/library/${repo}:[0-9]{14}\$' \
          | sort -t: -k2 -rn \
          | tail -n +4 \
          | xargs -r -n1 sudo k3s ctr images rm" || true
}

deploy_backend() {
  local image="watani-b2c-service:$TAG"
  echo "==> Building $image"
  docker build -t "$image" "$SCRIPT_DIR/watani-b2c-service"

  echo "==> Shipping $image to $REMOTE_HOST"
  docker save "$image" | gzip | dd status=progress | $SSH "gunzip | sudo k3s ctr images import -"

  echo "==> Applying namespace + ConfigMap"
  # Keeps the live ConfigMap in sync with git - previously only 02-backend.yaml was applied,
  # so edits here never reached the server and the app silently fell back to application.yml defaults.
  cat "$SCRIPT_DIR/deploy/k8s/00-namespace.yaml" "$SCRIPT_DIR/deploy/k8s/01-backend-config.yaml" | \
    $SSH "sudo k3s kubectl apply -f -"

  echo "==> Applying manifest + rolling out $image"
  # Substitutes the built tag into the manifest so a spec edit and an image bump land as one rollout.
  sed "s|watani-b2c-service:v1|$image|" "$SCRIPT_DIR/deploy/k8s/02-backend.yaml" | \
    $SSH "sudo k3s kubectl apply -f - && \
          sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=300s"

  echo "==> Pruning old watani-b2c-service images (keeping newest 3)"
  prune_old_images watani-b2c-service
}

deploy_frontend() {
  local image="watani-b2c-website:$TAG"
  echo "==> Building $image"
  docker build \
    --build-arg NEXT_PUBLIC_API_BASE_URL="$NEXT_PUBLIC_API_BASE_URL" \
    --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
    -t "$image" "$SCRIPT_DIR/watani-b2c-website"

  echo "==> Shipping $image to $REMOTE_HOST"
  docker save "$image" | gzip | dd status=progress | $SSH "gunzip | sudo k3s ctr images import -"

  echo "==> Applying manifest + rolling out $image"
  sed "s|watani-b2c-website:v1|$image|" "$SCRIPT_DIR/deploy/k8s/03-frontend.yaml" | \
    $SSH "sudo k3s kubectl apply -f - && \
          sudo k3s kubectl rollout status deployment/watani-b2c-website -n watani --timeout=180s"

  echo "==> Pruning old watani-b2c-website images (keeping newest 3)"
  prune_old_images watani-b2c-website
}

deploy_amanat() {
  local image="amanat-backend:$TAG"
  echo "==> Building $image"
  docker build -t "$image" "$SCRIPT_DIR/amanat-portal-watany-generated"

  echo "==> Shipping $image to $REMOTE_HOST"
  docker save "$image" | gzip | dd status=progress | $SSH "gunzip | sudo k3s ctr images import -"

  echo "==> Applying manifest + rolling out $image"
  # 08-amanat.yaml bundles ConfigMap/Deployment/Service/Ingress together (unlike watani's split
  # files) - the Secret (amanat-backend-credentials) is applied separately, once, out of band.
  # 360s, not the 180s the other two use: this app's startupProbe alone allows 60 x 5s = 300s
  # before readiness even starts counting, so 180s can fail a rollout that is still coming up.
  sed "s|amanat-backend:v1|$image|" "$SCRIPT_DIR/deploy/k8s/08-amanat.yaml" | \
    $SSH "sudo k3s kubectl apply -f - && \
          sudo k3s kubectl rollout status deployment/amanat-backend -n watani --timeout=360s"

  echo "==> Pruning old amanat-backend images (keeping newest 3)"
  prune_old_images amanat-backend
}
