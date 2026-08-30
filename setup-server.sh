#!/usr/bin/env bash
# setup-server.sh — ONE-TIME server setup on a fresh Ubuntu/Debian KVM
# Run as root or sudo user: bash setup-server.sh
set -e

echo "==> 1. System update"
apt-get update && apt-get upgrade -y

echo "==> 2. Install Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> 3. Install pnpm"
npm install -g pnpm

echo "==> 4. Install PM2"
npm install -g pm2

echo "==> 5. Install Redis"
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

echo "==> 6. Install Caddy"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo "==> 7. Clone repository"
mkdir -p /srv/myfiti
git clone https://github.com/btembong/myfiti.git /srv/myfiti

echo "==> 8. Install dependencies"
cd /srv/myfiti
pnpm install --frozen-lockfile

echo "==> 9. Build API"
cd /srv/myfiti/apps/api
pnpm run build

echo "==> 10. Build web"
cd /srv/myfiti/apps/web
pnpm run build

echo "==> 11. Copy Caddyfile"
cp /srv/myfiti/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy

echo "==> 12. Start PM2 processes"
cd /srv/myfiti
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # follow the printed command to enable PM2 on boot

echo ""
echo "==> Done! Check status:"
echo "    pm2 status"
echo "    caddy status (or: systemctl status caddy)"
echo ""
echo "IMPORTANT: Before starting, create these env files:"
echo "    /srv/myfiti/apps/api/.env   (see apps/api/.env.example)"
echo "    /srv/myfiti/apps/web/.env.local"
