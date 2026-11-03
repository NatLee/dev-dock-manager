from django.conf import settings
from docker.errors import APIError, ContainerError

from xterm import access


def can_use_nvidia_docker() -> bool:
    """Whether a container can run with the NVIDIA runtime: runs nvidia-smi in
    settings.NVIDIA_CHECK_IMAGE (pulled on first use) and removes the container afterwards."""
    client = access.docker_client()
    container = None
    try:
        container = client.containers.run(
            settings.NVIDIA_CHECK_IMAGE,
            command='nvidia-smi',
            runtime='nvidia',  # Specify the NVIDIA runtime
            detach=True,
            auto_remove=True,  # Remove container after execution
        )
        # If the command was successful, NVIDIA Docker is available
        return True
    except (APIError, ContainerError) as e:
        # If there was an error, log it and return False
        print(f"Error checking NVIDIA Docker availability: {e}")
        return False
    finally:
        # Cleanup: Stop container if it's still running
        if container is not None:
            try:
                container.stop()
            except Exception:
                pass  # If container doesn't exist or is already removed, ignore
