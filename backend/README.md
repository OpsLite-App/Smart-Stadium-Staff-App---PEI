# Backend — Dev Stack

This document explains how to run the backend dev stack locally using Docker Compose.

Quick summary
- The entire backend (MQTT broker, Postgres DBs, Java services, Python services, emulator) is defined in `docker-compose.dev.yml` at the repository root.
- You only need Docker (Docker Desktop / Docker Engine) and Docker Compose to run the stack; builds happen inside containers (Maven, Python, etc.).

Prerequisites
- Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux).
- 4+ GB free disk and a few CPU cores recommended.
- Internet access to pull base images on first run.

Start the dev stack (recommended)
```bash
# from repository root
docker compose -f docker-compose.dev.yml up --build
```

Run detached
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Stop and clean (remove volumes)
```bash
docker compose -f docker-compose.dev.yml down -v
```

Rebuild without cache
```bash
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up --force-recreate -d
```

Useful commands
- Check service status: `docker compose -f docker-compose.dev.yml ps`
- Tail logs: `docker compose -f docker-compose.dev.yml logs -f ws-gateway`
- View a container's full logs: `docker logs <container_name>`
- Exec into a container: `docker exec -it <container_name> /bin/sh`

Ports (dev defaults)
- Mosquitto (MQTT): 1883
- Postgres (auth DB): 5432
- Postgres (map DB): 5435 -> container 5432
- Auth service: 8081
- WS gateway: 8089
- Map service: 8000
- Routing: 8002
- Queueing: 8003
- Congestion: 8005
- Emergency: 8006
- Maintenance: 8007

Configuration notes
- The compose file sets environment variables for services (e.g. `AUTH_SERVICE_URL`, `DATABASE_URI`, `mqtt.broker`). Edit `docker-compose.dev.yml` to change defaults.
- The Map Service auto-seeds sample data on startup (the emulator depends on this).
- The WS Gateway validates JWTs by calling `POST {auth.serviceUrl}/auth/validate` — ensure the `auth-service` is healthy before connecting clients.

Troubleshooting
- If a Python container fails with `exec: 'uvicorn': executable file not found`, ensure the service's `requirements.txt` contains `uvicorn` and rebuild the image (`--no-cache` recommended).
- For Java build issues, check Maven logs in the build stage; the Dockerfiles use an internal Maven builder image so you don't need Maven installed locally.
- On Windows, ensure Docker Desktop has WSL2 enabled (or Hyper-V) and enough memory for the build.

Frontend notes
- The mobile frontend (`staff-app/frontend`) is not required to run the backend but can connect to the WS Gateway (STOMP endpoint `/ws`). To run the frontend locally you need Node/npm (or Yarn) and Expo.

Next steps (optional)
- Add containerized frontend entries to the compose file if you want a fully containerized dev environment.

If you want, I can add a short `Makefile` or shell script to wrap these commands and a one-page troubleshooting section for common errors.
