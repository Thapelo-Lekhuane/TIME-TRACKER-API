# Docker deployment – Time Tracker API

## Prerequisites

- Docker and Docker Compose installed
- `backend/.env` configured (see below)

## 1. Configure environment

Copy and edit the backend env file:

```bash
# If you have an example:
cp backend/.env.example backend/.env

# Edit backend/.env and set at least:
# - DATABASE_URL (PostgreSQL connection string, e.g. Neon)
# - JWT_SECRET
# - ADMIN_EMAIL, ADMIN_PASSWORD
# - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (for emails)
```

Your existing `backend/.env` is used at **runtime** via `env_file` in docker-compose; it is not copied into the image (and is in `.dockerignore`).

## 2. Build and run

From the **project root** (where `docker-compose.yml` is):

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f
```

## 3. Access

- **Web app:** http://localhost (port 80) – frontend + proxied `/api` to backend  
- **Backend only:** http://localhost:3000 (if you expose it for debugging)

The frontend container serves the built React app and proxies `/api` to the backend container.

## 4. Optional: use a local PostgreSQL database

To run Postgres in Docker instead of Neon:

1. In `docker-compose.yml`, uncomment the `postgres` service and the `depends_on` / `healthcheck` under `backend`, and the `volumes` section.
2. Set in `backend/.env`:
   ```env
   DATABASE_URL=postgresql://timetracker:changeme@postgres:5432/timetracker
   ```
3. Run:

   ```bash
   docker compose up -d --build
   ```

Replace `changeme` with a strong password and use the same in the `postgres` service `POSTGRES_PASSWORD`.

## 5. Useful commands

```bash
# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Backend logs only
docker compose logs -f backend

# Shell into backend container
docker compose exec backend sh
```

## 6. Production notes

- Use a strong `JWT_SECRET` and secure `ADMIN_PASSWORD`.
- Prefer HTTPS in front of the app (e.g. reverse proxy with Let’s Encrypt).
- Keep `backend/.env` out of version control and inject it via your deployment (e.g. secrets or env files on the server).
