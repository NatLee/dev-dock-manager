
import socket

def check_port_on_docker_host(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)  # Timeout for the operation
        result = sock.connect_ex((host, port))
        # If connect_ex returns 0, the port is in use
        return result != 0

def find_multiple_free_ports(count):
    host = 'host.docker.internal'
    base_port = 1024  # Start scanning from port 1024
    free_ports = []

    while len(free_ports) < count and base_port < 65535:
        if check_port_on_docker_host(host, base_port):
            free_ports.append(base_port)
        base_port += 1

    if len(free_ports) < count:
        raise Exception("Not enough free ports available.")
    
    return free_ports