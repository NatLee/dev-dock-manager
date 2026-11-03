import uuid
import json
import asyncio
import select
import fcntl
import struct
import termios

import docker

from asgiref.sync import sync_to_async
from asgiref.sync import async_to_sync

from django.contrib.auth.models import User

from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncWebsocketConsumer

from xterm import access

import logging
logger = logging.getLogger(__name__)

# Close codes the dashboard understands (4000+ is the application range)
CLOSE_BAD_REQUEST = 4000
CLOSE_UNAUTHORIZED = 4001
CLOSE_NOT_FOUND = 4004

# Notification groups: admins hear about every desktop, users only about their own.
ADMINS_GROUP = 'notifications_admins'
NOTIFICATIONS_SUBPROTOCOL = 'notifications'


def user_group(user_id):
    return f'notifications_user_{user_id}'


TOKEN_SUBPROTOCOL_PREFIX = 'token.'


def token_from_subprotocols(subprotocols):
    """The JWT the dashboard passes as a 'token.<JWT>' WebSocket subprotocol, or None.

    The JWT is sent unchanged (frontend/lib/wsProtocols.ts): base64url parts joined by dots are
    already a valid subprotocol. Base64-encoding it again added '=' and '/', which browsers refuse.
    """
    for protocol in subprotocols or []:
        if protocol.startswith(TOKEN_SUBPROTOCOL_PREFIX):
            return protocol[len(TOKEN_SUBPROTOCOL_PREFIX):] or None
    return None


async def user_from_token(token):
    """The active user an access token belongs to, or None (bad token, unknown or disabled user)."""
    if not token:
        return None
    try:
        user_id = AccessToken(token)['user_id']
    except (InvalidToken, TokenError, KeyError):
        return None
    return await sync_to_async(User.objects.filter(id=user_id, is_active=True).first)()

class ConsoleConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.docker_socket = None
        self.group_name = 'console'

        subprotocols = self.scope['subprotocols'] or []
        subprotocol_container = next((p for p in subprotocols if p.startswith('container.')), None)
        token = token_from_subprotocols(subprotocols)
        if not token or not subprotocol_container:
            logger.error("Missing required subprotocols")
            await self.close(code=CLOSE_BAD_REQUEST)
            return
        self.user = await user_from_token(token)
        if self.user is None:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return

        await self.accept(subprotocol_container)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        print(f"[{self.group_name}][{self.channel_name}] connected.")


    async def disconnect(self, code):
        print(f"[{self.group_name}][{self.channel_name}] disconnected.")
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.cleanup()

    async def cleanup(self):
        session_data = await sync_to_async(self.scope["session"].load)()
        if session_data:
            container_id = session_data.get('id')
            exec_id = session_data.get('exec_id')
            pid_path = session_data.get('pid')
            if exec_id:
                try:
                    await self.kill_process(container_id, pid_path)
                    await self.delete_pid_file(container_id, pid_path)
                except Exception as e:  # Consider more specific error handling
                    print(f"Error in exec command: {e}")

    @sync_to_async
    def kill_process(self, container_id, pid_path):
        client = docker.APIClient()
        kill_command = f'kill $(cat {pid_path})'
        print(f'Killing process with command: {kill_command}')
        try:
            kill_exec_id = client.exec_create(container_id, cmd=kill_command)['Id']
            client.exec_start(kill_exec_id, detach=False)
        except docker.errors.APIError as e:
            print(f"Error in exec command: {e}")

    @sync_to_async
    def delete_pid_file(self, container_id, pid_path):
        client = docker.APIClient()
        delete_pid_command = f'rm -f {pid_path}'
        print(f'Deleting PID file with command: {delete_pid_command}')
        delete_exec_id = client.exec_create(container_id, cmd=delete_pid_command)['Id']
        client.exec_start(delete_exec_id, detach=False)

    async def receive(self, text_data):
        message = json.loads(text_data)
        # Route message to appropriate handler
        action = message.get('action')
        payload = message.get('payload')
        # Handle the message based on the action
        if action in ('shell', 'attach') and not await self.may_use(payload["Id"]):
            # someone else's desktop, or not a desktop at all: same answer as "doesn't exist"
            await self.close(code=CLOSE_NOT_FOUND)
            return
        if action == 'shell':
            container_id = payload["Id"]
            # Start a shell in the container
            await self.start_shell(container_id)
        elif action == 'attach':
            container_id = payload["Id"]
            # Attach to the container
            await self.start_attach(container_id)
        elif action == 'pty_input':
            # Send input to the container
            await self.pty_input(payload)
        elif action == 'pty_resize':
            # Handle resize action
            await self.pty_resize(payload)

    async def start_shell(self, container_id):
        client = docker.APIClient()
        container_status = self.get_container_status(container_id)
        if container_status != "running":
            await self.close()
            return
        # Generate a unique filename using UUID
        unique_pid_file = f"/tmp/_process_{uuid.uuid4()}.pid"
        exec_instance = client.exec_create(
            container_id,
            cmd=f'sh -c "echo $$ > {unique_pid_file}; exec /bin/bash"',
            stdin=True, tty=True, stderr=True, stdout=True
        )
        exec_id = exec_instance['Id']

        self.docker_socket = self.get_docker_socket(exec_id)
        await self.save_session(container_id, exec_id, unique_pid_file)
        # Start the background task to read and forward the output
        asyncio.create_task(self.read_and_forward_output())

    async def start_attach(self, container_id):
        client = docker.APIClient()
        # check if container is running
        container_status = self.get_container_status(container_id)
        if container_status != "running":
            await self.close()
            return
        self.docker_socket = client.attach_socket(
            container_id,
            params={'stdin': 1, 'stream': 1,'stdout':1,'stderr':1}
        )
        asyncio.create_task(self.read_and_forward_output())

    def get_docker_socket(self, exec_id):
        client = docker.APIClient()
        return client.exec_start(exec_id=exec_id, detach=False, socket=True)

    async def read_and_forward_output(self):
        while True:
            # non-blocking wait for output
            await asyncio.sleep(0.01)
            timeout_sec = 0
            (data_ready, _, _) = select.select([self.docker_socket], [], [], timeout_sec)
            if data_ready:
                output = self.docker_socket._sock.recv(1024)
                if output == b'':
                    # disconnect when we stop receiving data
                    await self.close()
                # Forward the output to the WebSocket
                text_data = output.decode('cp437')[8:]
                await self.send(text_data=text_data)

    async def pty_input(self, payload):
        session_data = await sync_to_async(self.scope["session"].load)()
        exec_id = session_data.get('exec_id')
        # Send the input to the docker socket
        await sync_to_async(self.docker_socket._sock.send)(payload["input"].encode())

    async def pty_resize(self, payload):

        pty_size = payload.get('size', {})
        # Validate pty_size
        if not pty_size.get('rows') or not pty_size.get('cols'):
            logger.error("Invalid pty_size")
            return

        # Get container info from session 
        session_data = await sync_to_async(self.scope["session"].load)()
        container_id = session_data.get('id')
        exec_id = session_data.get('exec_id')

        # Only allow resize for shell sessions (where exec_id exists)
        if not exec_id:
            logger.warning("Resize attempted for attach session - ignoring")
            return

        # Get Docker client
        client = docker.APIClient()
        
        try:
            height = pty_size.get('rows', 24)
            width = pty_size.get('cols', 80)
            client.exec_resize(exec_id, height=height, width=width)
        except docker.errors.APIError as e:
            logger.error(f"Failed to resize tty: {e}")

    @sync_to_async
    def may_use(self, container_id):
        container = access.find_gui_container(access.docker_client(), container_id)
        return container is not None and access.can_access(self.user, access.container_owner(container))

    def get_container_status(self, container_id):
        client = docker.APIClient()
        return client.containers(all=True, filters={'id': container_id})[0]["State"]

    async def save_session(self, container_id, exec_id, unique_pid_file):
        # Serialize the docker_socket before saving it if necessary
        session_data = {
            'id': container_id,
            'exec_id': exec_id,
            'pid': unique_pid_file
        }
        self.scope["session"].update(session_data)
        await sync_to_async(self.scope["session"].save)()


class NotificationConsumer(AsyncWebsocketConsumer):
    """Pushes job results to the dashboard: admins get every desktop's, users only their own.
    Authenticates like the console, with a 'token.<JWT>' subprotocol."""

    async def connect(self):
        self.group = None
        user = await user_from_token(token_from_subprotocols(self.scope['subprotocols']))
        if user is None:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        self.group = ADMINS_GROUP if access.is_admin(user) else user_group(user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept(NOTIFICATIONS_SUBPROTOCOL)

    async def disconnect(self, close_code):
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    # Receive message from room group
    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message']
        }))


def send_notification_to_group(message, owner_id=None):
    """Send a notification about a desktop to its owner and to the admins."""
    channel_layer = get_channel_layer()
    groups = [ADMINS_GROUP] + ([user_group(owner_id)] if owner_id is not None else [])
    for group in groups:
        async_to_sync(channel_layer.group_send)(group, {
            'type': 'send_notification',
            'message': message
        })
