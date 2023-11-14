import socket

def check_port_in_use(port) -> bool:
    # check if port is in use in the host
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # If connect_ex returns 0, the port is in use
        return s.connect_ex(('host.docker.internal', port)) == 0

