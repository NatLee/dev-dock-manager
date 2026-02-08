import docker
import django_rq

from django.http import JsonResponse

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status

from drf_yasg.utils import swagger_auto_schema

from xterm.task import run_image_task
from xterm.task import run_container_task
from xterm.task import remove_container_task
from xterm.task import stop_container_task
from xterm.task import restart_container_task

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

# GUI image tag name prefix
GUI_IMAGE_TAG_NAME = 'gui-vnc'


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
    permission_classes = [AllowAny]
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
    permission_classes = (IsAuthenticated,)
    def get(self, request, format=None):
        client = docker.from_env()
        containers = client.containers.list(all=True)

        # Get system-wide information
        info = client.df()
        # Create a dictionary for quick access to container sizes
        container_sizes_rw = {c['Id']: c.get('SizeRw', 0) for c in info['Containers']}
        container_sizes_rfs = {c['Id']: c.get('SizeRootFs', 0) for c in info['Containers']}

        # Serialize the container data
        container_data = []
        for container in containers:
            image_tag = None
            image_tags = container.image.tags
            if image_tags:
                image_tag = image_tags[0]

            if image_tag is None:
                continue

            if image_tag and image_tag.split(':')[0] != GUI_IMAGE_TAG_NAME:
                # only select containers with name starting with `gui-d`
                continue

            # Fetch detailed container information
            try:
                container_detail = client.api.inspect_container(container.id)
            except Exception:
                continue  # Skip if container is not found

            # Fetch container size using the dictionary
            container_size_rw = container_sizes_rw.get(container.id, 0)
            container_size_rfs = container_sizes_rfs.get(container.id, 0)

            # Check for privileged mode and device requests (for GPUs)
            privileged = container_detail['HostConfig'].get('Privileged', False)
            device_requests:list = container_detail['HostConfig'].get('DeviceRequests', [])
            
            # Get port bindings
            port_bindings:dict = container_detail['HostConfig'].get('PortBindings', {})

            nvdocker = False
            if device_requests:
                nvdocker = any(req.get('Driver', '') == 'nvidia' for req in device_requests)

            container_info = {
                'id': container.id,
                'name': container.name,
                'status': container.status,
                'command': container.attrs['Config']['Cmd'],
                'short_id': container.short_id,
                'image_tag': image_tag,
                'ports': parse_ports(port_bindings),
                'privileged': privileged,
                'nvdocker': nvdocker,
                'size_raw': container_size_rw,
                'size_fs': container_size_rfs,
            }

            container_data.append(container_info)

        # Serialize additional information if necessary
        info = client.info()  # Transform this as needed

        return Response({
            'containers': container_data,
        })

class ImagesListView(APIView):
    permission_classes = (IsAuthenticated,)
    def get(self, request, format=None):
        client = docker.from_env()
        images = client.images.list()

        # Serialize the image data
        image_data = []
        for image in images:
            name = image.tags[0] if image.tags else None
            image_info = {
                'id': image.id[7:],
                'size': round(image.attrs['Size']/1048576, 2),
                'short_id': image.short_id[7:],
                'name': name
            }
            image_data.append(image_info)

        # Serialize additional information if necessary
        info = client.info()  # Transform this as needed

        return Response({
            'images': image_data,
            'info': info  # Ensure this is in a serializable format
        })

class ConsoleView(APIView):
    permission_classes = (IsAuthenticated,)
    def get(self, request, id, action):
        client = docker.from_env()
        container = client.containers.get(id)
        commands = container.attrs['Config']['Cmd']
        if not commands:
            command = None
        else:
            command = ' '.join(commands)

        return Response({
            'id': id,
            'container_name': container.attrs['Name'][1:],  # Remove the leading "/"
            'image': container.attrs['Config']['Image'],
            'short_id': container.short_id,
            'command': command,
            'action': action
        })

class RunContainerView(APIView):
    permission_classes = (IsAuthenticated,)

    @swagger_auto_schema(
        operation_summary="Run Container",
        operation_description="Run a container with the specified parameters",
        responses=run_container_responses,
        request_body=run_container_request_body,
    )
    def post(self, request, *args, **kwargs):
        container_name = request.data['container_name']
        container_name = container_name.replace("/", "-")

        # Container name must be at least 2 character long
        if len(container_name) < 2:
            return Response({
                'error': 'Container name must be at least 1 character long'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Container name must start with a letter
        if not container_name[0].isalpha():
            return Response({
                'error': 'Container name must start with a letter [a-zA-Z]'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if the container name is already in use
        client = docker.from_env()
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

        user = request.data['user']
        password = request.data['password']
        vnc_password = request.data['vnc_password']
        root_password = request.data['root_password']

        # Convert string input to Boolean
        privileged = request.data.get('privileged', 'false')
        if isinstance(privileged, str):
            privileged = privileged.lower() == 'true'

        nvdocker = request.data.get('nvdocker', 'false')
        if isinstance(nvdocker, str):
            nvdocker = nvdocker.lower() == 'true'


        volumes = {}
        if is_linux():
            # notice: docker in docker but using host path
            # { host_location: {bind: container_location, mode: access_mode}}

            # mount host time zone to container
            volumes['/etc/localtime'] = {'bind': '/etc/localtime', 'mode': 'ro'}

        # Call the task function with the form inputs
        job = run_image_task.delay(
            image_name=GUI_IMAGE_TAG_NAME,
            ports={
                # {container_port: host_port}
                # '5901/tcp': vnc, # no need to use vnc
                # '6901/tcp': novnc, # already use traefik to proxy the URL
                '22/tcp': ssh,
            },
            volumes=volumes,
            environment={
                'VNC_PW': vnc_password,
                'VNC_RESOLUTION': '1600x900',
                'DEFAULT_USER': user,
                'DEFAULT_USER_PASSWORD': password,
                'ROOT_PASSWORD': root_password,
            },
            name=container_name,
            privileged=privileged,
            nvdocker=nvdocker
        )
        return JsonResponse({
            "container_name": container_name,
            "task_id": job.id
        })

from xterm.consumers import send_notification_to_group

class ContainersControl(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):

        cmd = request.data['cmd']
        _id = request.data['id']

        job = None

        if cmd == "start" or cmd == "restart" or cmd == "stop"  or cmd == "remove":
            # ========================
            # Send notification to group
            message = {
                "action": "WAITING",
                "details": f"Waiting [{_id[:8]}] for the task to complete [{cmd}]",
                "data": {
                    "container_id": _id,
                    "cmd": cmd,
                }
            }
            send_notification_to_group(message)
            # ========================

        if cmd == "start":
            job = run_container_task.delay(_id)
        elif cmd == "stop":
            job = stop_container_task.delay(_id)
        elif cmd == "remove":
            job = remove_container_task.delay(_id)
        elif cmd == "restart":
            job = restart_container_task.delay(_id)

        if job:
            job_id = job.id
            return JsonResponse({"task_id": job_id})

        return JsonResponse({"task_id": None})


