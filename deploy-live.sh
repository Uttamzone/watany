#!/bin/bash
set -euo pipefail

echo "=================================================="
echo " Building & Deploying Live Website + Backend"
echo "=================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
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

echo "3. Applying Database Repairs..."
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
" || true

echo "4. Restarting Kubernetes Pods..."
sudo k3s kubectl delete pod -n watani -l app=watani-b2c-service || true
sudo k3s kubectl delete pod -n watani -l app=watani-b2c-website || true

echo "5. Waiting for Services to become Ready..."
sudo k3s kubectl rollout status deployment/watani-b2c-service -n watani --timeout=120s || true
sudo k3s kubectl rollout status deployment/watani-b2c-website -n watani --timeout=120s || true

echo ""
echo "Current Cluster Status:"
sudo k3s kubectl get pods -n watani

echo ""
echo "=================================================="
echo " Live Deployment Complete!"
echo " Both Backend and Website are now running live."
echo "=================================================="
