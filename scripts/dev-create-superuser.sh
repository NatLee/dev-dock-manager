#!/bin/bash
# Create Django superuser. Usage: dev-create-superuser.sh [username] [password]
# Defaults: username=admin, password=1234

USERNAME="${1:-admin}"
PASSWORD="${2:-1234}"
EMAIL="${USERNAME}@admin.com"

docker exec -it -e DJANGO_SUPERUSER_PASSWORD="$PASSWORD" d-gui-manager-web \
  bash -c "python manage.py createsuperuser --noinput --username '$USERNAME' --email '$EMAIL'"
