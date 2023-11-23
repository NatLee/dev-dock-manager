import docker
from xterm.utils.parse_ports import parse_ports

def is_port_used_by_container(port:int) -> bool:
    client = docker.from_env()
    for container in client.containers.list(all=True):
        port_bindings:dict = client.api.inspect_container(container.id)['HostConfig'].get('PortBindings', {})
        ports = parse_ports(port_bindings)
        if str(port) in ports.values():
            return True
    return False

