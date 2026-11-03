"""Desktop (GUI container) API: list, create, start/stop/restart/remove, console metadata, port and
environment checks.

Permissions: users see and act on their own desktops, admins on all of them, and anything else is a
404 (see xterm.access). Only admins may create privileged containers.
"""
import docker
from django.contrib.auth.models import User
from django.http import JsonResponse

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from drf_yasg.utils import swagger_auto_schema

from xterm import access
from xterm.task import run_image_task
from xterm.task import run_container_task
from xterm.task import remove_container_task
from xterm.task import stop_container_task
from xterm.task import restart_container_task
from xterm.consumers import send_notification_to_group

from xterm.utils.parse_ports import parse_ports
from xterm.utils.is_int import is_int
from xterm.utils.find_multiple_free_ports import find_multiple_free_ports
from xterm.utils.check_port_in_use import check_port_in_use
from xterm.utils.is_port_used_by_container import is_port_used_by_container
from xterm.utils.can_use_nvidia_docker import can_use_nvidia_docker
from xterm.utils.is_linux import is_linux

from xterm.schemas import count_param, free_ports_response, error_response
from xterm.schemas import run_container_request_body, run_container_responses
from xterm.schemas import check_port_params, check_port_in_used_response


class NvidiaDockerCheckAPIView(APIView):
    """
    API View to check if NVIDIA Docker can be used on the system.
    """

    def get(self, request, *args, **kwargs):
        if can_use_nvidia_docker():
            return Response(
                {'nvidia_docker_available': True}
            )
        else:
            return Response(
                {'nvidia_docker_available': False}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

class LinuxCheckAPIView(APIView):
    """
    API View to check if the host OS is Linux.
    """

    def get(self, request, *args, **kwargs):
        if is_linux():
            return Response(
                {'is_linux': True}
            )
        else:
            return Response(
                {'is_linux': False}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

class FreePortsAPIView(APIView):
    @swagger_auto_schema(
        operation_summary="Get Free Ports in host",
        operation_description="Returns a list of free ports on the server",
        manual_parameters=[count_param],
        responses={
            200: free_ports_response,
            400: error_response,
        }
    )
    def get(self, request, *args, **kwargs):
        count = request.query_params.get('count', 30)
        try:
            count = int(count)
            if count <= 0:
                raise ValueError("Count must be a positive integer")
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        free_ports = find_multiple_free_ports(count)
        return Response({'free_ports': free_ports}, status=status.HTTP_200_OK)

class PortCheckAPIView(APIView):

    @swagger_auto_schema(
        operation_summary="Check Port",
        operation_description="Check if a port is in use in host",
        manual_parameters=check_port_params,
        responses=check_port_in_used_response
    )
    def get(self, request, *args, **kwargs):
        port = request.query_params.get('port')
        if port is None:
            return JsonResponse({'error': 'Port parameter is missing'}, status=400)
        try:
            is_used = check_port_in_use(int(port)) or is_port_used_by_container(port)
            return JsonResponse({'port': int(port), 'is_used': is_used})
        except ValueError:
            return JsonResponse({'error': 'Invalid port value'}, status=400)

class ContainersListView(APIView):
    def get(self, request, format=None):
        client = access.docker_client()
        containers = client.containers.list(all=True)

        # Get system-wide information
        info = client.df()
        # Create a dictionary for quick access to container sizes
        container_sizes_rw = {c['Id']: c.get('SizeRw', 0) for c in info['Containers']}
        container_sizes_rfs = {c['Id']: c.get('SizeRootFs', 0) for c in info['Containers']}

        container_data = []
        for container in containers:
            config = container.attrs['Config']
            if not access.is_gui_image(config.get('Image')):
                continue
            owner_id = access.owner_of(config.get('Labels'))
            if not access.can_access(request.user, owner_id):
                continue

            # Fetch detailed container information
            try:
                container_detail = client.api.inspect_container(container.id)
            except Exception:
                continue  # Skip if container is not found

            # Check for privileged mode and device requests (for GPUs)
            host_config = container_detail['HostConfig']
            device_requests = host_config.get('DeviceRequests') or []

            container_data.append({
                'id': container.id,
                'name': container.name,
                'status': container.status,
                'command': config['Cmd'],
                'short_id': container.short_id,
                'image_tag': config.get('Image'),
                'ports': parse_ports(host_config.get('PortBindings') or {}),
                'privileged': host_config.get('Privileged', False),
                'nvdocker': any(req.get('Driver', '') == 'nvidia' for req in device_requests),
                'size_raw': container_sizes_rw.get(container.id, 0),
                'size_fs': container_sizes_rfs.get(container.id, 0),
                'owner_id': owner_id,
            })

        # Owner names, so admins can tell whose desktop each one is
        owner_ids = {c['owner_id'] for c in container_data if c['owner_id'] is not None}
        names = dict(User.objects.filter(id__in=owner_ids).values_list('id', 'username'))
        for c in container_data:
            c['owner'] = names.get(c['owner_id'])

        return Response({
            'containers': container_data,
        })

class ImagesListView(APIView):
    def get(self, request, format=None):
        client = access.docker_client()
        images = client.images.list()

        # Only images that have a tag named DOCKER_IMAGE_NAME (e.g. gui-vnc:latest)
        image_data = []
        for image in images:
            matching_tags = [t for t in image.tags if access.is_gui_image(t)]
            if not matching_tags:
                continue
            image_info = {
                'id': image.id[7:],
                'size': round(image.attrs['Size'] / 1048576, 2),
                'short_id': image.short_id[7:],
                'name': matching_tags[0],
                'tags': matching_tags,
            }
            image_data.append(image_info)

        return Response({
            'images': image_data,
            'info': client.info(),
        })

class ConsoleView(APIView):
    def get(self, request, id, action):
        container = access.accessible_container(access.docker_client(), request.user, id)
        commands = container.attrs['Config']['Cmd']
        return Response({
            'id': container.id,
            'container_name': container.attrs['Name'][1:],  # Remove the leading "/"
            'image': container.attrs['Config']['Image'],
            'short_id': container.short_id,
            'command': ' '.join(commands) if commands else None,
            'action': action
        })

class RunContainerView(APIView):

    @swagger_auto_schema(
        operation_summary="Run Container",
        operation_description="Run a container with the specified parameters",
        responses=run_container_responses,
        request_body=run_container_request_body,
    )
    def post(self, request, *args, **kwargs):
        privileged = request.data.get('privileged', False)
        if isinstance(privileged, str):
            privileged = privileged.lower() == 'true'
        if privileged and not access.is_admin(request.user):
            return Response({
                'error': 'Only admins can create privileged containers'
            }, status=status.HTTP_403_FORBIDDEN)

        nvdocker = request.data.get('nvdocker', False)
        if isinstance(nvdocker, str):
            nvdocker = nvdocker.lower() == 'true'

        container_name = request.data['container_name']
        container_name = container_name.replace("/", "-")

        # Container name must be at least 2 character long
        if len(container_name) < 2:
            return Response({
                'error': 'Container name must be at least 2 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Container name must start with a letter
        if not container_name[0].isalpha():
            return Response({
                'error': 'Container name must start with a letter [a-zA-Z]'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if the container name is already in use
        client = access.docker_client()
        try:
            client.containers.get(container_name)
            return Response({
                'error': f'Container name {container_name} is already in use'
            }, status=status.HTTP_400_BAD_REQUEST)
        except docker.errors.NotFound:
            pass

        ssh = request.data['ssh']

        if not all(is_int(val) for val in [ssh]):
            return Response({"error": "Non-integer value provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Check the ssh port is used by other container port or not
        if is_port_used_by_container(ssh):
            return Response({
                'error': f'Port [{ssh}] is already in use by container'
            }, status=status.HTTP_400_BAD_REQUEST)


        # Check the ssh port is not in use
        if check_port_in_use(int(ssh)):
            return Response({
                'error': f'Port [{ssh}] is already in use by other services'
            }, status=status.HTTP_400_BAD_REQUEST)

        volumes = {}
        if is_linux():
            # notice: docker in docker but using host path
            # { host_location: {bind: container_location, mode: access_mode}}

            # mount host time zone to container
            volumes['/etc/localtime'] = {'bind': '/etc/localtime', 'mode': 'ro'}

        # Everything else (resolution, locale...) is left to the image defaults.
        job = run_image_task.delay(
            ports={f'{access.GUI_SSH_PORT}/tcp': ssh},
            volumes=volumes,
            environment={
                'VNC_PW': request.data['vnc_password'],
                'DEFAULT_USER': request.data['user'],
                'DEFAULT_USER_PASSWORD': request.data['password'],
                'ROOT_PASSWORD': request.data['root_password'],
            },
            name=container_name,
            owner_id=request.user.id,
            privileged=privileged,
            nvdocker=nvdocker
        )
        return JsonResponse({
            "container_name": container_name,
            "task_id": job.id
        })


CONTROL_TASKS = {
    "start": run_container_task,
    "stop": stop_container_task,
    "remove": remove_container_task,
    "restart": restart_container_task,
}


class ContainersControl(APIView):

    def post(self, request, *args, **kwargs):
        cmd = request.data['cmd']
        task = CONTROL_TASKS.get(cmd)
        if task is None:
            return Response({'error': 'invalid cmd'}, status=status.HTTP_400_BAD_REQUEST)
        container = access.accessible_container(access.docker_client(), request.user, request.data['id'])
        owner_id = access.container_owner(container)

        send_notification_to_group({
            "action": "WAITING",
            "details": f"Waiting [{container.id[:8]}] for the task to complete [{cmd}]",
            "data": {
                "container_id": container.id,
                "cmd": cmd,
            }
        }, owner_id)
        job = task.delay(container.id, owner_id)
        return JsonResponse({"task_id": job.id})
