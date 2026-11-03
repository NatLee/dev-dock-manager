"""RQ jobs that do the Docker work for the desktop API. Each job reports back through the
notifications WebSocket, addressed to the desktop's owner (and the admins)."""
import docker
from django.conf import settings
from django_rq import job

from xterm import access
from xterm.consumers import send_notification_to_group


@job
def run_image_task(ports, volumes, environment, name, owner_id, privileged=False, nvdocker=False):
    client = access.docker_client()
    device_requests = []
    if nvdocker:
        device_requests.append(
            docker.types.DeviceRequest(
                count=-1,  # -1 specifies all available GPUs
                capabilities=[['gpu']],  # This is the equivalent of `--gpus all`
                driver='nvidia'
            )
        )

    container = client.containers.run(
        settings.DOCKER_IMAGE_NAME,
        stdin_open=True,
        detach=True,
        tty=True,
        ports=ports,
        volumes=volumes,
        environment=environment,
        name=name,
        privileged=privileged,
        device_requests=device_requests,
        network=settings.DOCKER_NETWORK,
        labels=access.gui_container_labels(name, owner_id),
    )

    image_name = container.image.tags[0] if container.image.tags else "none"
    msg = f"Container [{container.name}] ({image_name}) has been created"
    send_notification_to_group({"action": "CREATED", "details": msg}, owner_id)
    return msg


def _control(container_id, owner_id, operation, action, verb):
    container = access.docker_client().containers.get(container_id)
    operation(container)
    msg = f"Container [{container.name}] has been {verb}"
    send_notification_to_group({"action": action, "details": msg}, owner_id)
    return msg


@job
def run_container_task(id, owner_id=None):
    return _control(id, owner_id, lambda c: c.start(), "STARTED", "started")


@job
def stop_container_task(id, owner_id=None):
    return _control(id, owner_id, lambda c: c.stop(), "STOPPED", "stopped")


@job
def remove_container_task(id, owner_id=None):
    return _control(id, owner_id, lambda c: c.remove(), "REMOVED", "removed")


@job
def restart_container_task(id, owner_id=None):
    return _control(id, owner_id, lambda c: c.restart(), "RESTARTED", "restarted")
