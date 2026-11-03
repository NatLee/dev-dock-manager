#!/bin/bash
set -e
# Migrations are committed with the code; startup only applies them.
python manage.py migrate
# Admin and Swagger pages need their CSS/JS served by whitenoise, which only serves collected files
python manage.py collectstatic --noinput > /dev/null
/usr/local/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
