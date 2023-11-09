import docker
from docker.errors import APIError, ContainerError

def can_use_nvidia_docker() -> bool:
    client = docker.from_env()
    test_image = 'nvidia/cuda:11.0.3-base-ubuntu20.04'
    test_command = 'nvidia-smi'

    try:
        # Run a container that utilizes GPU
        container = client.containers.run(
            test_image,
            command=test_command,
            runtime='nvidia',  # Specify the NVIDIA runtime
            detach=True,
            auto_remove=True,  # Remove container after execution
        )

        # Fetch logs to check if nvidia-smi command was successful
        #logs = container.logs()
        #print(logs.decode('utf-8'))  # Optional: Print output for verification

        # If the command was successful, NVIDIA Docker is available
        return True
    except (APIError, ContainerError) as e:
        # If there was an error, log it and return False
        print(f"Error checking NVIDIA Docker availability: {e}")
        return False
    finally:
        # Cleanup: Stop container if it's still running
        try:
            container.stop()
        except Exception:
            pass  # If container doesn't exist or is already removed, ignore
