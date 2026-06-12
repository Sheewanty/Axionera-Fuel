# FuelStation OS Go-Live Runbook

## Current State

- CI passes on `main`.
- The deploy workflow builds and pushes the Docker image to GHCR.
- Deployment requires a reachable DigitalOcean Droplet with SSH secrets configured in GitHub.

## 1. Bootstrap Droplet

On a fresh Ubuntu 24.04 Droplet:

```bash
curl -fsSL https://raw.githubusercontent.com/Sheewanty/Axionera-Fuel/main/deploy/bootstrap-digitalocean.sh -o bootstrap-digitalocean.sh
bash bootstrap-digitalocean.sh
```

Log out and back in after bootstrap so Docker group membership applies.

## 2. DNS

Point the app domain A record to the Droplet public IPv4 address.

Example:

```text
app.example.com  A  <droplet-ip>
```

## 3. GitHub Secrets

Repository: `Sheewanty/Axionera-Fuel`

Create these secrets under `Settings -> Secrets and variables -> Actions`:

```text
DO_HOST=<droplet-public-ip-or-domain>
DO_USER=<ssh-user>
DO_SSH_PRIVATE_KEY=<private-key-that-can-ssh-to-droplet>
APP_DOMAIN=<live-domain-without-https>
POSTGRES_PASSWORD=<strong-postgres-password>
AUTH_SECRET=<openssl-rand-base64-32-output>
UPSTASH_REDIS_REST_URL=<upstash-rest-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
GHCR_USERNAME=<github-username>
GHCR_TOKEN=<github-token-with-read:packages>
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

## 4. Trigger Deploy

Push to `main`, or run the `Deploy` workflow manually from GitHub Actions.

## 5. Verify

```bash
curl -fsS https://<APP_DOMAIN>/api/health
```

Expected response:

```json
{"ok":true,"service":"fuelstation-os","timestamp":"..."}
```

## 6. First Login

If demo seed data is needed on a non-production/staging database only:

```bash
cd /opt/fuelstation-os
docker compose --env-file .env.production run --rm -e NODE_ENV=development app npm run db:seed
```

Do not run demo seed against a real production customer database.
