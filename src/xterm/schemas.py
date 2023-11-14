from drf_yasg import openapi
from rest_framework import status

# Request Parameters
count_param = openapi.Parameter(
    'count',
    openapi.IN_QUERY,
    description="Number of free ports to find",
    type=openapi.TYPE_INTEGER,
    required=False
)

# Response Schemas
free_ports_response = openapi.Response(
    description="A list of free ports",
    schema=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'free_ports': openapi.Schema(
                type=openapi.TYPE_ARRAY,
                items=openapi.Schema(type=openapi.TYPE_INTEGER),
                description="An array of free port numbers",
            ),
        },
    ),
    examples={
        "application/json": {
            "free_ports": [8080, 8081, 8082]
        }
    },
)

error_response = openapi.Response(
    description="Invalid input",
    examples={
        "application/json": {
            "error": "Count must be a positive integer"
        }
    },
)


run_container_request_body = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=["container_name", "ssh", "user", "password", "vnc_password", "root_password"],
    properties={
        "container_name": openapi.Schema(
            type=openapi.TYPE_STRING, description="Name of the container"
        ),
        "ssh": openapi.Schema(
            type=openapi.TYPE_INTEGER, description="SSH port"
        ),
        "user": openapi.Schema(
            type=openapi.TYPE_STRING, description="Default user name"
        ),
        "password": openapi.Schema(
            type=openapi.TYPE_STRING, description="Default user password"
        ),
        "vnc_password": openapi.Schema(
            type=openapi.TYPE_STRING, description="VNC password"
        ),
        "root_password": openapi.Schema(
            type=openapi.TYPE_STRING, description="Root password"
        ),
        'privileged': openapi.Schema(
            type=openapi.TYPE_BOOLEAN, description='Run container in privileged mode'
        ),
        'nvdocker': openapi.Schema(
            type=openapi.TYPE_BOOLEAN, description='Run container with Nvidia Docker support'
        ),
    },
)

# Define the response schema
run_container_responses = {
    status.HTTP_200_OK: openapi.Response(
        description="Container has been created and task is initiated",
        examples={
            "application/json": {
                "result": [{"Message": "Container {container_name} ({image_name}) has been created", "Data": "{task_id}"}],
                "code": 0,
            }
        },
    ),
    status.HTTP_400_BAD_REQUEST: openapi.Response(
        description="Error due to non-integer value provided for ports",
        examples={
            "application/json": {
                "result": [{"Message": "Non-integer value provided"}],
                "code": 400,
            }
        },
    )
}


check_port_params = [
    openapi.Parameter('port', openapi.IN_QUERY, description="Port to check", type=openapi.TYPE_INTEGER, required=True),
]

check_port_in_used_response = {
    200: openapi.Response(description="Port status returned"),
}