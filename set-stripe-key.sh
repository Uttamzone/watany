#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo "Usage: ./set-stripe-key.sh sk_live_your_key_here"
    exit 1
fi

STRIPE_KEY="$1"

sed -i "s|STRIPE_API_KEY:.*|STRIPE_API_KEY: \"$STRIPE_KEY\"|g" deploy/k8s/01-backend-config.yaml
sed -i "s|STRIPE_SECRET_KEY:.*|STRIPE_SECRET_KEY: \"$STRIPE_KEY\"|g" deploy/k8s/01-backend-config.yaml

echo "Applying updated config to Kubernetes..."
sudo k3s kubectl apply -f deploy/k8s/01-backend-config.yaml

echo "Restarting backend service..."
sudo k3s kubectl rollout restart deployment/watani-b2c-service -n watani
sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=60s

echo "Stripe live secret key updated and backend restarted successfully!"
