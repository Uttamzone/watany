# Production Deployment Guide: GitHub & Hetzner VPS

This guide provides step-by-step instructions for deploying the **Watani & Sons** platform (Next.js Frontend + Express Node.js Backend + PostgreSQL Database) onto a **Hetzner VPS** server with automated **GitHub Actions CI/CD**, **Stripe Payment Webhooks**, and **Freightcom Shipping Rates**.

---

## 1. System Architecture Overview

```
                          [ Shopper Browser / Stripe Webhook ]
                                           │
                                    (HTTPS Port 443)
                                           │
                                     [ Nginx Proxy ]
                                           │
                ┌──────────────────────────┴──────────────────────────┐
                │                                                     │
        (Port 3000 - Next.js)                                (Port 8080 - Express)
     [ watani-b2c-website ]                              [ watani-b2c-service ]
                                                                      │
                                                             [ PostgreSQL Database ]
                                                                 (Port 5432)
```

- **Domain**: `https://wataniandsons.ca`
- **Frontend**: Next.js 16 (Port `3000`)
- **Backend API**: Node.js Express (Port `8080`)
- **Stripe Webhook Endpoint**: `https://wataniandsons.ca/api/webhooks/payment`
- **Stripe Webhook Secret**: `whsec_aLPGTG4hhKB1dElq8qBgrIJmM6sUTNio`

---

## 2. Hetzner VPS Provisioning & Initial Setup

### Step 2.1: Provision VPS Instance
1. Log into your **Hetzner Cloud Console**.
2. Create a new server:
   - **Location**: Ashburn / Falkenstein (or closest to your primary target market in Canada/US).
   - **Image**: Ubuntu 24.04 LTS (or 22.04 LTS).
   - **Type**: CX22 or CPX21 (2 vCPU, 4GB RAM recommended for production).
   - **SSH Key**: Add your SSH public key for secure access.

### Step 2.2: Server Package Updates & Base Tools
Connect to your Hetzner VPS:
```bash
ssh root@YOUR_SERVER_IP
```

Update system packages and install essential utilities:
```bash
apt update && apt upgrade -y
apt install -y curl git ufw build-essential
```

### Step 2.3: Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```
Verify installation:
```bash
node -v   # Should output v20.x.x
pm2 -v    # Should output PM2 version
```

### Step 2.4: Install & Configure PostgreSQL 16
```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
```

Create PostgreSQL user & database:
```bash
sudo -u postgres psql -c "CREATE USER watani WITH PASSWORD 'YourSecureDatabasePassword123!';"
sudo -u postgres psql -c "CREATE DATABASE watani_db OWNER watani;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE watani_db TO watani;"
```

---

## 3. Application Setup on Hetzner VPS

### Step 3.1: Clone Repository
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_GITHUB_USERNAME/watani-b2c.git watani
cd /var/www/watani
```

### Step 3.2: Configure Backend (`watani-b2c-service`)
Create `/var/www/watani/watani-b2c-service/.env`:
```bash
cd /var/www/watani/watani-b2c-service
nano .env
```
Paste environment configuration:
```env
PORT=8080
DATABASE_URL=postgres://watani:YourSecureDatabasePassword123!@localhost:5432/watani_db
JWT_SECRET=super-secret-jwt-key-watani-2026

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_aLPGTG4hhKB1dElq8qBgrIJmM6sUTNio

# Freightcom Credentials (optional for live API credentials)
FREIGHTCOM_API_KEY=your_freightcom_api_key
FREIGHTCOM_ACCOUNT_ID=your_freightcom_account_id
```

Install dependencies:
```bash
npm install --production
```

### Step 3.3: Configure Frontend (`watani-b2c-website`)
Create `/var/www/watani/watani-b2c-website/.env.production`:
```bash
cd /var/www/watani/watani-b2c-website
nano .env.production
```
Paste frontend environment variables:
```env
NEXT_PUBLIC_API_BASE_URL=https://wataniandsons.ca
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Install dependencies and build production app:
```bash
npm install
npm run build
```

---

## 4. PM2 Process Manager Ecosystem

Create PM2 configuration file at `/var/www/watani/ecosystem.config.js`:
```js
module.exports = {
  apps: [
    {
      name: "watani-backend",
      cwd: "/var/www/watani/watani-b2c-service",
      script: "src/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 8080
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "watani-frontend",
      cwd: "/var/www/watani/watani-b2c-website",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
```

Start both applications with PM2 and configure auto-start on boot:
```bash
cd /var/www/watani
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 5. Nginx Reverse Proxy & SSL (Certbot)

### Step 5.1: Install Nginx & Certbot
```bash
apt install -y nginx certbot python3-certbot-nginx
```

### Step 5.2: Configure Nginx Site
Create Nginx configuration `/etc/nginx/sites-available/wataniandsons.ca`:
```nginx
server {
    server_name wataniandsons.ca www.wataniandsons.ca;

    # Backend API & Stripe Webhooks
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend Next.js Application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and test configuration:
```bash
ln -s /etc/nginx/sites-available/wataniandsons.ca /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 5.3: Obtain Free SSL Certificate
```bash
certbot --nginx -d wataniandsons.ca -d www.wataniandsons.ca
```

---

## 6. Stripe Webhook Verification Setup

In your **Stripe Dashboard**:
1. Navigate to **Developers → Webhooks**.
2. Endpoint URL: `https://wataniandsons.ca/api/webhooks/payment`
3. Events to listen for:
   - `charge.succeeded`
   - `charge.failed`
   - `payment_intent.succeeded`
   - `checkout.session.completed`
4. Copy the Webhook Signing Secret (`whsec_aLPGTG4hhKB1dElq8qBgrIJmM6sUTNio`) into `/var/www/watani/watani-b2c-service/.env`.

When Stripe sends a payment notification, the backend handles signature validation and automatically marks the order in PostgreSQL as `PROCESSING` and payment as `PAID`.

---

## 7. GitHub Actions Automated Deployment (CI/CD)

Create `.github/workflows/deploy.yml` in your local codebase:

```yaml
name: Deploy to Hetzner VPS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.HETZNER_VPS_IP }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/watani
            git pull origin main

            # Build backend
            cd /var/www/watani/watani-b2c-service
            npm install --production

            # Build frontend
            cd /var/www/watani/watani-b2c-website
            npm install
            npm run build

            # Reload PM2 services seamlessly
            cd /var/www/watani
            pm2 reload ecosystem.config.js
```

### Configure Secrets in GitHub:
Go to **GitHub Repo → Settings → Secrets and variables → Actions** and add:
- `HETZNER_VPS_IP`: Your server's public IP address.
- `SSH_PRIVATE_KEY`: Your SSH private key authorized to log into the Hetzner server.

Every `git push origin main` will now automatically build and reload your live production website on Hetzner VPS!
