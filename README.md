<div align="center" style="text-align: center">

# **Dev Dock Manager**

<p style="text-align: center">
  <img align="center" src="./doc/login.gif" alt="Logging in to the dashboard">
</p>

<a href="./LICENSE"><img src="https://img.shields.io/github/license/NatLee/dev-dock-manager" alt="License: MIT"></a>

</div>

Dev Dock Manager is a small self-hosted dashboard for handing out Linux desktops on one machine. Each person
logs in, creates a container from the [dev-dock](https://github.com/NatLee/dev-dock) image, and gets a full
Xfce desktop in the browser (NoVNC), a web terminal and an SSH port, without touching Docker themselves. The
API is Django (with Django REST framework and Channels for WebSockets), the dashboard is Next.js, and Traefik
sits in front of both.

It grew out of [dev-dock](https://github.com/NatLee/dev-dock) and
[Django Docker GUI](https://github.com/NatLee/django-docker-gui) (a web UI for Docker with a terminal).

## The Dev Dock family

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/family-dark.webp">
    <img src="docs/images/family-light.webp" alt="The Dev Dock family: dev-dock builds the gui-vnc desktop image; dev-dock-manager (Django) and dev-dock-manager-rust (Rust) include it as the gui/ submodule and start one gui-vnc container per environment through the Docker socket">
  </picture>
</p>

| Repo | What it is |
|---|---|
| [dev-dock](https://github.com/NatLee/dev-dock) | The `gui-vnc` image: Xfce desktop, VNC, noVNC and SSH in one container. Included here as `gui/`. |
| **dev-dock-manager** (this repo) | The manager with a Django (Python) API. |
| [dev-dock-manager-rust](https://github.com/NatLee/dev-dock-manager-rust) | The same dashboard, routes and container setup, with the API rewritten in Rust. |

The two managers look the same from the browser and start the same containers, so pick one per machine.
What differs is the backend:

| | dev-dock-manager | dev-dock-manager-rust |
|---|---|---|
| API | Django + Daphne, run by supervisord | one Rust binary (axum, bollard) |
| Background jobs | a separate `rqworker` process (RQ) | a worker task inside the API process |
| Users | Django users in SQLite | `users` table in SQLite, Argon2 password hashes |
| Login tokens | access 60 hours, refresh 1 day | access 1 hour, refresh 1 day |
| Extras | Django admin, Swagger and RQ pages | `/health` |

## How it works

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/architecture-dark.webp">
    <img src="docs/images/architecture-light.webp" alt="Browser to Traefik on port 8000. Traefik sends /api, /dashboard/api and /ws to the Django backend (priority 10), /novnc/name/ to that desktop container's noVNC on 6901 with the prefix stripped (priority 5), and everything else to the Next.js frontend on 3000. The backend uses Redis, SQLite and the Docker socket; SSH goes straight to each container's host port">
  </picture>
</p>

Everything you open goes through **Traefik** on port 8000, which picks the target by path:

| Path | Goes to |
|---|---|
| `/api/*`, `/dashboard/api/*`, `/ws/*` | the Django backend (`d-gui-manager-web`, port 8000) |
| `/novnc/<name>/` | the noVNC page of the desktop called `<name>` (port 6901), with the prefix stripped |
| everything else | the Next.js dashboard (`d-gui-manager-frontend`, port 3000) |

Traefik learns these routes from Docker labels. The services get theirs from `docker-compose.yml`, and each
desktop gets its own when the backend creates it. All of them share the external network `d-gui-network`. SSH
is the one thing that skips Traefik: each desktop publishes port 22 on a host port you choose.

Inside `d-gui-manager-web`, supervisord runs two programs: `manage.py runserver` (served by Daphne, so the same
process handles REST calls and WebSockets) and `manage.py rqworker default`, which does the Docker work. Redis
(`d-gui-manager-redis`) carries the job queue, the WebSocket notifications and the cache.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/lifecycle-dark.webp">
    <img src="docs/images/lifecycle-light.webp" alt="Sequence: 1 log in with POST /api/auth/token; 2 create with POST /dashboard/api/container/new, the API queues a job and returns a task_id; 3 rqworker creates and starts the gui-vnc container; 4 CREATED arrives on /ws/notifications/; 5 the console WebSocket /ws/console/ runs docker exec bash or attach; 6 NoVNC through Traefik; 7 start, stop, restart, remove through /dashboard/api/containers/control">
  </picture>
</p>

What each click does:

1. **Log in.** The dashboard posts your username and password to `/api/auth/token` and keeps the access and
   refresh tokens (JWT) in the browser's localStorage. Every API call sends the access token.
2. **Create.** The API checks the name (two characters or more, starting with a letter) and that the SSH port
   is free, puts an RQ job on Redis and answers with a `task_id` right away.
3. **`rqworker` starts the container** from `gui-vnc`: your passwords as environment variables, port 22 on the
   SSH port you picked, `/etc/localtime` mounted read-only, the Traefik labels for `/novnc/<name>/`, and
   optionally privileged mode or all NVIDIA GPUs.
4. **The list refreshes** when `CREATED` arrives on the `/ws/notifications/` WebSocket.
5. **Console** opens a WebSocket to `/ws/console/` with two subprotocols, `token.<base64 JWT>` and
   `container.<id>`, and gets a `bash` started with `docker exec` (a root shell). **Attach** connects to the
   container's main process instead. Keys and window size go up as `pty_input` and `pty_resize`.
6. **NoVNC** opens `/novnc/<name>/` through Traefik and asks for the VNC password you set when creating it.
7. **Start, stop, restart, remove** go through the same queue. You see `WAITING`, then `STARTED`, `STOPPED` and so on.

## Interface

- Create container

    ![create](./doc/create.gif)

- Web Terminal

    ![web terminal](./doc/console.gif)

- NoVNC

    ![novnc](./doc/novnc.gif)

## Quick start

You need Linux with Docker running (the backend talks to `/var/run/docker.sock`). On Windows, use Docker inside WSL.

1. **Get the code with the image submodule:**

   ```bash
   git clone --recurse-submodules https://github.com/NatLee/dev-dock-manager.git
   cd dev-dock-manager
   # already cloned? git submodule update --init --recursive
   ```

2. **Build the desktop image** (it ends up as `gui-vnc`; a first build takes 10 to 30 minutes and about 7.8 GB):

   ```bash
   cd gui && docker compose build && cd ..
   ```

   Or pull a pre-built one from [natlee/gui-vnc](https://hub.docker.com/r/natlee/gui-vnc) and name it
   `gui-vnc`, because that's the name the backend starts containers from:

   ```bash
   docker pull natlee/gui-vnc:20260208-arm64
   docker tag natlee/gui-vnc:20260208-arm64 gui-vnc
   ```

3. **Set the secret key, create the network and start the stack:**

   ```bash
   cp .env.example .env
   sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$(openssl rand -base64 48)|" .env
   docker network create d-gui-network
   docker compose build && docker compose up -d
   ```

   `DJANGO_SECRET_KEY` signs sessions and login tokens, so it has no default: compose stops with a clear
   message if it's missing. Debug pages stay off unless you set `DJANGO_DEBUG=1` in `.env`. The backend
   applies the database migrations when it starts. The `nvidia-cuda` service only prints
   "CUDA image ready" and exits.

4. **Create a superuser** to log in with:

   ```bash
   ./dev-tool.sh create-superuser
   ```

   It asks for a username and password (defaults `admin` / `1234`). To skip the prompts:
   `./scripts/dev-create-superuser.sh admin mypassword`.

5. **Open http://localhost:8000/** and log in. It sends you to `/dashboard/containers`.

## Good to know

- **Opening it from another machine.** The dashboard calls the API at `NEXT_PUBLIC_API_ORIGIN` from
  `frontend/.env.local`, which is `http://localhost:8000`, and Next.js bakes that in at build time. For any
  other address, set it to that address, or leave it empty (`NEXT_PUBLIC_API_ORIGIN=`) so the dashboard uses
  whatever address it was opened from. Then run `docker compose build frontend && docker compose up -d`.
- **Ports.** 8000 is the app, 8080 is the Traefik dashboard. Each desktop also takes the SSH port you pick.
- **Data and code.** `./src` is mounted into the backend for hot reloading, so the SQLite database
  (`src/db.sqlite3`) and the logs (`src/logs/`) end up there. The desktops are ordinary containers named after
  what you typed, so `docker ps` shows them.
- **Image name.** The backend creates containers from `DOCKER_IMAGE_NAME` (`gui-vnc` in
  `docker-compose.yml`) and only lists containers whose image has exactly that name, which is why a pulled
  image needs the `gui-vnc` tag.
- **Admin pages** (staff accounts): Django admin at `/api/__hidden_admin/`, Swagger at `/api/__hidden_swagger`,
  the RQ queue at `/api/__django-rq/`. The backend also has a Google sign-in endpoint
  (`/api/auth/google/token`) that the dashboard doesn't use.

### Before you put it on a network

It's built for a trusted group on one machine. Every account can see and control every desktop (there's no
per-user ownership), and can create privileged containers. With the Docker socket mounted, that amounts to
root on the host. Also, the Traefik dashboard on 8080 runs with `--api.insecure`, so don't expose that port.

## Nvidia Docker Support

Optional. With NVIDIA drivers and the NVIDIA Container Toolkit on the host, the create dialog lets you give a
container all GPUs (`/dashboard/api/nvdocker/check` tells the dashboard whether that works).

## Dev helper script

```bash
./dev-tool.sh --help
```

- `bash`: shell in the backend container (`d-gui-manager-web`).
- `create-superuser`: create a Django superuser.
- `backend-debug`: stop the supervised Django server and run `runserver` in the foreground.
- `supervisorctl`: manage the programs supervisord runs.

# License

[MIT](./LICENSE)
