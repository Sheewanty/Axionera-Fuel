# DigitalOcean Droplet Bootstrap

Use this for the first production Droplet.

## Server

- Ubuntu 24.04 LTS
- 2 vCPU / 2GB RAM minimum for MVP
- SSH key login only
- UFW firewall

## Bootstrap Commands

```bash
curl -fsSL https://raw.githubusercontent.com/Sheewanty/Axionera-Fuel/main/deploy/bootstrap-digitalocean.sh -o bootstrap-digitalocean.sh
bash bootstrap-digitalocean.sh
```

Copy deployment files into:

```text
/opt/fuelstation-os
```

Required files:

```text
docker-compose.yml
Caddyfile
.env.production
```

For GitHub Actions deployment, configure these production secrets:

```text
DO_HOST
DO_USER
DO_SSH_PRIVATE_KEY
APP_DOMAIN
POSTGRES_PASSWORD
AUTH_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
GHCR_USERNAME
GHCR_TOKEN
```
