# CI/CD And DigitalOcean Droplet Plan

## Target Infrastructure

Start with one DigitalOcean Droplet:

- Ubuntu 24.04 LTS
- Docker and Docker Compose
- Caddy for HTTPS reverse proxy
- PostgreSQL container for MVP, then DigitalOcean Managed PostgreSQL when customers grow
- App container
- Optional Redis container later

## Production Services

```text
caddy
app
postgres
backup
```

## Required GitHub Secrets

```text
DO_HOST
DO_USER
DO_SSH_PRIVATE_KEY
APP_DOMAIN
DATABASE_URL
AUTH_SECRET
NEXTAUTH_URL
REGISTRY_USERNAME
REGISTRY_TOKEN
```

If using GitHub Container Registry:

```text
GHCR_TOKEN
```

## CI Workflow

Run on pull request and push to main:

1. Checkout
2. Install dependencies
3. Lint
4. Typecheck
5. Run unit tests
6. Run Prisma generate
7. Run migration validation
8. Build app
9. Build Docker image

## CD Workflow

Run on push to `main` after CI passes:

1. Build Docker image
2. Push image to registry
3. SSH to Droplet
4. Pull image
5. Run database migrations
6. Restart Docker Compose services
7. Run health check

Use GitHub protected environments for production.

## Droplet Bootstrap

Manual once:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin ufw git
sudo usermod -aG docker $USER
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
mkdir -p /opt/fuelstation-os
```

Then copy:

```text
docker-compose.prod.yml
Caddyfile
.env.production
```

## Backup Policy

Minimum:

- Nightly PostgreSQL dump
- Retain 14 daily backups
- Store outside the app container
- Later push to DigitalOcean Spaces

## Deployment Safety

- Never run destructive migration automatically without review.
- Always back up database before migration in production.
- Keep `.env.production` only on the server or in secure secrets.
- Do not commit private keys, database passwords, or production env files.
