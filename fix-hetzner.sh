#!/bin/bash
set -euo pipefail

echo "==> Applying Kubernetes manifests..."
sudo k3s kubectl apply -f deploy/k8s/00-namespace.yaml
sudo k3s kubectl apply -f deploy/k8s/01-backend-config.yaml
sudo k3s kubectl apply -f deploy/k8s/02-backend.yaml
sudo k3s kubectl apply -f deploy/k8s/04-ingress.yaml

echo "==> Fixing Hetzner PostgreSQL Categories & Flyway State..."
sudo -u postgres psql -d watani_b2c -c "
INSERT INTO categories (slug, name, tagline, description, display_order, active, created_at, updated_at, version) VALUES
  ('olive-oil', 'Olive Oil', 'Olive Oil', 'Olive Oil', 1, TRUE, NOW(), NOW(), 0),
  ('olives', 'Olives', 'Olives', 'Olives', 2, TRUE, NOW(), NOW(), 0),
  ('zaatar', 'Zaatar', 'Zaatar', 'Zaatar', 3, TRUE, NOW(), NOW(), 0),
  ('cheese', 'Cheese', 'Cheese', 'Cheese', 4, TRUE, NOW(), NOW(), 0),
  ('ghee', 'Ghee', 'Ghee', 'Ghee', 5, TRUE, NOW(), NOW(), 0),
  ('spices-grains', 'Spices & Grains', 'Spices & Grains', 'Spices & Grains', 6, TRUE, NOW(), NOW(), 0),
  ('ceramics', 'Ceramics', 'Ceramics', 'Ceramics', 7, TRUE, NOW(), NOW(), 0),
  ('beauty-care', 'Beauty Care', 'Beauty Care', 'Beauty Care', 8, TRUE, NOW(), NOW(), 0)
ON CONFLICT (slug) DO NOTHING;

DELETE FROM flyway_schema_history WHERE version IN ('29', '34') OR success = FALSE;
"

echo "==> Restarting watani-b2c-service pod..."
sudo k3s kubectl delete pod -n watani -l app=watani-b2c-service || true

echo "==> Waiting for pod to become ready..."
sleep 15
POD_NAME=$(sudo k3s kubectl get pod -n watani -l app=watani-b2c-service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [ -n "$POD_NAME" ] && [ -d "/root/watany/watani-b2c-website/public/uploads" ]; then
    echo "==> Syncing product images to pod $POD_NAME..."
    sudo k3s kubectl cp /root/watany/watani-b2c-website/public/uploads "watani/$POD_NAME:/app/" || true
fi

echo "==> Done! Check status with: sudo k3s kubectl get pods -n watani"
