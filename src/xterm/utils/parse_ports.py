from typing import Dict

def parse_ports(container_info) -> Dict[str,str]:
    port_mapping = {
        '5901': 'vnc',
        '6901': 'novnc',
        '22': 'ssh'
    }
    port_info = container_info.get('Ports', {})

    result_mapping = {}

    for port, mappings in port_info.items():
        port_number = port.split('/')[0]  # Removing the '/tcp' part
        service = port_mapping.get(port_number, 'Unknown')

        # Assuming we only want the port
        if mappings:  # Check if there are any port mappings
            result_mapping[service] = str(mappings[0]['HostPort'])

    return result_mapping

