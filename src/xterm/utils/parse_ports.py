from typing import Dict

def parse_ports(port_bindings:Dict) -> Dict[str,str]:
    port_mapping = {
        '5901/tcp': 'vnc',
        '6901/tcp': 'novnc',
        '22/tcp': 'ssh'
    }

    # Resulting mapping is a dict of service:port
    result_mapping = {}

    for port, mappings in port_bindings.items():
        service = port_mapping.get(port, 'Unknown')
        # Assuming we only want the port
        if mappings:  # Check if there are any port mappings
            result_mapping[service] = str(mappings[0]['HostPort'])

    return result_mapping

