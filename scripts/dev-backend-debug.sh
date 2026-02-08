#!/bin/bash
docker exec -it d-gui-manager-web bash -c "supervisorctl -c /etc/supervisor/conf.d/supervisord.conf stop django"
docker exec -it d-gui-manager-web bash -c "python manage.py runserver 0.0.0.0:8000"
