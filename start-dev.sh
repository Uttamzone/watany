#!/usr/bin/env bash
set -e

echo "=================================================="
echo " Starting Watani B2C Backend & Frontend Services"
echo "=================================================="

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping background services..."
    kill $(jobs -p) 2>/dev/null || true
    echo "Services stopped."
}
trap cleanup EXIT INT TERM

ROOT_DIR="/home/personal/Music/watani-project-main"

echo "1. Starting Express Backend Service (watani-b2c-service) on http://localhost:8080..."
cd "$ROOT_DIR/watani-b2c-service"
npm start &

echo "2. Starting Frontend Website (watani-b2c-website) on http://localhost:3000..."
cd "$ROOT_DIR/watani-b2c-website"
npm run dev &

echo ""
echo "=================================================="
echo " Watani Application is now starting!"
echo " Frontend: http://localhost:3000"
echo " Backend:  http://localhost:8080"
echo " Press Ctrl+C to stop both services."
echo "=================================================="

wait
