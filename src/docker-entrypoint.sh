#!/bin/bash
set -e
# Migrations are committed with the code; startup only applies them.
python manage.py migrate
# Admin and Swagger pages need their CSS/JS served by whitenoise, which only serves collected files
python manage.py collectstatic --noinput > /dev/null
# exec: supervisord becomes PID 1 and gets docker stop's SIGTERM. A shell as PID 1 ignores it, so docker
# waited the full 10 seconds and then killed everything (exit code 137).
exec /usr/local/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
