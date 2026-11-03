"""Which desktop containers a user may see and act on.

A desktop ("GUI container") is a container created from the image named settings.DOCKER_IMAGE_NAME.
The manager labels each one it creates with its creator's user id (OWNER_LABEL). Users may act on
their own desktops, admins on all of them. Anything else, including containers that aren't desktops
at all, is treated as if it didn't exist.

Every view and consumer that touches a single container goes through accessible_container() or
find_gui_container() + can_access(), so the HTTP API and the WebSockets can't drift apart.
"""
from typing import Optional

import docker
from django.conf import settings
from rest_framework.exceptions import NotFound

# Docker label holding the owner's user id; the Rust manager uses the same name.
OWNER_LABEL = "dev-dock.owner"

# Ports the dev-dock image serves (its NO_VNC_PORT and SSH_PORT).
GUI_NOVNC_PORT = 6901
GUI_SSH_PORT = 22


def docker_client() -> docker.DockerClient:
    """The Docker client every view, task and consumer uses (and tests replace)."""
    return docker.from_env()


def image_repository(reference: str) -> str:
    """An image reference without its tag or digest: gui-vnc:latest -> gui-vnc,
    registry:5000/team/gui-vnc:1 -> registry:5000/team/gui-vnc."""
    reference = reference.split("@", 1)[0]
    last_segment_start = reference.rfind("/") + 1
    tag_colon = reference.rfind(":", last_segment_start)
    return reference if tag_colon == -1 else reference[:tag_colon]


def is_gui_image(reference: Optional[str]) -> bool:
    """True when the reference names the desktop image exactly (any tag)."""
    return bool(reference) and image_repository(reference) == settings.DOCKER_IMAGE_NAME


def owner_of(labels: Optional[dict]) -> Optional[int]:
    """The owner's user id from a container's labels; None when missing or not a number."""
    try:
        return int((labels or {})[OWNER_LABEL])
    except (KeyError, TypeError, ValueError):
        return None


def is_admin(user) -> bool:
    """Admins are Django staff (the user management page sets is_staff and is_superuser together)."""
    return bool(user.is_staff)


def can_access(user, owner_id: Optional[int]) -> bool:
    """Admins may act on every desktop, users only on their own. Ownerless desktops (created
    before ownership existed) are admin-only."""
    return is_admin(user) or (owner_id is not None and owner_id == user.id)


def gui_container_labels(name: str, owner_id: int) -> dict:
    """Labels for a new desktop: its owner, and the Traefik route /novnc/<name>/ -> its noVNC port."""
    router = f"d-gui-{name}"
    return {
        OWNER_LABEL: str(owner_id),
        "traefik.enable": "true",
        f"traefik.http.routers.{router}.rule": f"PathPrefix(`/novnc/{name}/`)",
        f"traefik.http.routers.{router}.priority": "5",
        f"traefik.http.routers.{router}.entrypoints": "web",
        f"traefik.http.services.{router}.loadbalancer.server.port": str(GUI_NOVNC_PORT),
        f"traefik.http.middlewares.{router}-strip-prefix.stripprefix.prefixes": f"/novnc/{name}/",
        f"traefik.http.routers.{router}.middlewares": f"{router}-strip-prefix",
        "traefik.docker.network": settings.DOCKER_NETWORK,
    }


def find_gui_container(client, container_id: str):
    """The desktop with this id or name, or None if there is no such container or it isn't a desktop."""
    try:
        container = client.containers.get(container_id)
    except docker.errors.NotFound:
        return None
    return container if is_gui_image(container.attrs["Config"].get("Image")) else None


def container_owner(container) -> Optional[int]:
    return owner_of(container.attrs["Config"].get("Labels"))


def accessible_container(client, user, container_id: str):
    """The desktop if this user may act on it; otherwise 404, so other people's desktops look
    exactly like ones that don't exist."""
    container = find_gui_container(client, container_id)
    if container is None or not can_access(user, container_owner(container)):
        raise NotFound("Container not found")
    return container
