#!/bin/bash
docker exec -it d-gui-manager-web supervisorctl -c /etc/supervisor/conf.d/supervisord.conf
