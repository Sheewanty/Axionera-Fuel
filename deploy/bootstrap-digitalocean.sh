#!/usr/bin/env bash
set -euo pipefail

sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl docker.io docker-compose-plugin ufw

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

sudo mkdir -p /opt/fuelstation-os/backups
sudo chown -R "$USER":"$USER" /opt/fuelstation-os

echo "Bootstrap complete. Log out and back in so Docker group membership takes effect."
