#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
    echo ""
    echo "Usage: ./set-stripe-key.sh sk_live_your_secret_key_here"
    echo ""
    echo "  NOTE: You MUST use your Stripe Secret Key (starts with sk_live_ or sk_test_)"
    echo "        or a Restricted Key (starts with rk_live_)."
    echo "        Do NOT use a Publishable Key (pk_live_...)."
    echo ""
    exit 1
fi

RAW_KEY="$1"
# Strip any leading/trailing whitespace, newlines, or quotes
STRIPE_KEY=$(echo "$RAW_KEY" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//')

if [[ "$STRIPE_KEY" == pk_* ]]; then
    echo ""
    echo "❌ ERROR: You provided a Publishable Key ($STRIPE_KEY)."
    echo "   The server requires your Stripe Secret Key (starts with sk_live_ or sk_test_) or Restricted Key (rk_...)."
    echo "   Please find your Secret Key in your Stripe Dashboard:"
    echo "   https://dashboard.stripe.com/apikeys"
    echo ""
    exit 1
fi

if [[ "$STRIPE_KEY" == whsec_* ]]; then
    echo ""
    echo "❌ ERROR: You provided a Webhook Signing Secret ($STRIPE_KEY)."
    echo "   'whsec_...' is ONLY used for verifying Stripe webhooks, not for processing checkout payments."
    echo "   The server requires your Stripe Secret Key (starts with sk_live_ or sk_test_)."
    echo "   Please find your Secret Key in your Stripe Dashboard:"
    echo "   https://dashboard.stripe.com/apikeys (Click 'Reveal live key' under Standard keys)"
    echo ""
    exit 1
fi

if [[ "$STRIPE_KEY" != sk_* && "$STRIPE_KEY" != rk_* ]]; then
    echo ""
    echo "⚠️  WARNING: Key does not start with 'sk_' or 'rk_'. Valid Stripe secret keys typically start with sk_live_ or sk_test_."
    echo ""
fi

# 1. Save to .env.stripe for persistent redeploy without modifying git
echo "STRIPE_SECRET_KEY=$STRIPE_KEY" > .env.stripe
chmod 600 .env.stripe

# 2. Reset deploy/k8s/01-backend-config.yaml in case previous sed dirtied it
git checkout deploy/k8s/01-backend-config.yaml 2>/dev/null || true

# 3. Patch the live Kubernetes ConfigMap
echo "Applying Stripe key to Kubernetes ConfigMap watani-backend-config..."
sudo k3s kubectl patch configmap watani-backend-config -n watani --type merge \
    -p "{\"data\":{\"STRIPE_SECRET_KEY\":\"$STRIPE_KEY\",\"STRIPE_API_KEY\":\"$STRIPE_KEY\"}}"

# 4. Rolling restart backend service
echo "Restarting backend service..."
sudo k3s kubectl rollout restart deployment/watani-b2c-service -n watani
sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=90s

echo ""
echo "=================================================="
echo "✓ Stripe Secret Key updated successfully!"
echo "  Prefix: ${STRIPE_KEY:0:12}..."
echo "  Backend is now running with the new key."
echo "=================================================="
echo ""
