# Server Deployment (Docker + Nginx)

This project is a static React app. It is hosted by:
- Building production assets with `npm run build`
- Serving `build/` via Nginx

## 1. Server prerequisites

On your Linux server (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

## 2. Clone and configure

```bash
git clone <your-repo-url>
cd S.A.D-DLW
```

Create/update `.env` before building:

```bash
cp .env.example .env
nano .env
```

Important:
- Only `REACT_APP_*` vars are injected into the frontend.
- Frontend env values are visible in browser build output, so do not put private server secrets here.

## 3. Build and run

```bash
sudo docker compose up -d --build
```

Check status:

```bash
sudo docker compose ps
sudo docker compose logs -f crashguard-web
```

App URL:
- `http://<your-server-ip>/`

## 4. Open firewall (if needed)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

## 5. Updating after new code

```bash
git pull
sudo docker compose up -d --build
```

## Optional: HTTPS with reverse proxy

For production domain + TLS, place Nginx Proxy Manager/Caddy/Traefik in front and terminate HTTPS there.
