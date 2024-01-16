import docker

def is_linux() -> bool:
    # check host OS is linux or not
    client = docker.from_env()
    info = client.info()
    return info['OSType'] == 'linux'
