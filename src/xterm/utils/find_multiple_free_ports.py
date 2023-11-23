from xterm.utils.check_port_in_use import check_port_in_use
from xterm.utils.is_port_used_by_container import is_port_used_by_container
def find_multiple_free_ports(count):
    # find multiple free ports in the host

    base_port = 1024  # Start scanning from port 1024
    free_ports = []

    while len(free_ports) < count and base_port < 65535:
        if not check_port_in_use(base_port) and not is_port_used_by_container(base_port):
            # find port is not in use in the host
            free_ports.append(base_port)
        base_port += 1

    if len(free_ports) < count:
        raise Exception("Not enough free ports available.")
    
    return free_ports