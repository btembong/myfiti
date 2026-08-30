#!/usr/bin/env bash
# deploy.sh — run on the server to pull latest code, rebuild, and restart
# Usage: bash deploy.sh
set -e

DEPLOY_DIR="/srv/myfiti"

echo "==> Pulling latest code"
cd "$DEPLOY_DIR"
git pull

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Building API"
cd "$DEPLOY_DIR/apps/api"
pnpm run build

echo "==> Building web"
cd "$DEPLOY_DIR/apps/web"
pnpm run build

echo "==> Reloading PM2 processes"
cd "$DEPLOY_DIR"
pm2 reload ecosystem.config.cjs --update-env

echo "==> Done! Check status with: pm2 status"
