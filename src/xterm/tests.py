"""Permission rules for desktops: users see and act on their own, admins on all, everything else is a
404; only admins create privileged containers; notifications reach only the owner and the admins;
every login token makes a WebSocket subprotocol browsers accept; the channel layer outlasts its waits.

Docker is replaced by a small in-memory fake (xterm.access.docker_client is the one place the code
gets a client from), so these tests need neither Docker nor Redis.
"""
import re
from unittest import mock

import docker
from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from xterm import access
from xterm.consumers import token_from_subprotocols

GUI = "gui-vnc"  # settings.DOCKER_IMAGE_NAME default
IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
# What a WebSocket subprotocol may contain (an RFC 7230 token); browsers throw on anything else.
SUBPROTOCOL = re.compile(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$")


class FakeContainer:
    def __init__(self, cid, name, image, owner=None, running=True):
        labels = {} if owner is None else {access.OWNER_LABEL: str(owner)}
        self.id, self.name, self.short_id = cid, name, cid[:12]
        self.status = "running" if running else "exited"
        self.attrs = {
            "Name": "/" + name,
            "Config": {"Image": image, "Labels": labels, "Cmd": ["supervisord"]},
            "HostConfig": {"PortBindings": {"22/tcp": [{"HostPort": "2222"}]}, "Privileged": False},
            "State": {"Running": running},
        }


class FakeDocker:
    """Just enough of docker.DockerClient for the views and consumers."""

    def __init__(self, *containers):
        self.items = list(containers)
        self.created = []
        self.containers = self
        self.api = self
        self.images = mock.Mock(list=mock.Mock(return_value=[]))

    # client.containers.*
    def list(self, all=False):
        return list(self.items)

    def get(self, ref):
        for c in self.items:
            if ref in (c.id, c.name):
                return c
        raise docker.errors.NotFound("No such container")

    def run(self, image, **kwargs):
        self.created.append((image, kwargs))
        return mock.Mock(name=kwargs["name"], image=mock.Mock(tags=[f"{image}:latest"]))

    # client.api.* / client.*
    def inspect_container(self, cid):
        return self.get(cid).attrs

    def df(self):
        return {"Containers": []}

    def info(self):
        return {}


def token_for(user):
    return str(RefreshToken.for_user(user).access_token)


class ImageRulesTest(SimpleTestCase):
    def test_image_repository_drops_tag_and_digest_only(self):
        self.assertEqual(access.image_repository("gui-vnc"), "gui-vnc")
        self.assertEqual(access.image_repository("gui-vnc:latest"), "gui-vnc")
        self.assertEqual(access.image_repository("gui-vnc@sha256:abc"), "gui-vnc")
        self.assertEqual(access.image_repository("registry:5000/team/gui-vnc:1"), "registry:5000/team/gui-vnc")

    def test_gui_image_needs_the_exact_name(self):
        self.assertTrue(access.is_gui_image("gui-vnc:latest"))
        self.assertFalse(access.is_gui_image("dev-dock-gui-vnc:e2e"))
        self.assertFalse(access.is_gui_image("natlee/gui-vnc:latest"))
        self.assertFalse(access.is_gui_image(None))

    def test_owner_label(self):
        self.assertEqual(access.owner_of({access.OWNER_LABEL: "7"}), 7)
        self.assertIsNone(access.owner_of({access.OWNER_LABEL: "x"}))
        self.assertIsNone(access.owner_of(None))
        labels = access.gui_container_labels("alice", 7)
        self.assertEqual(labels[access.OWNER_LABEL], "7")
        self.assertEqual(labels["traefik.http.routers.d-gui-alice.rule"], "PathPrefix(`/novnc/alice/`)")
        self.assertEqual(labels["traefik.http.services.d-gui-alice.loadbalancer.server.port"], "6901")


class DesktopPermissionsTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", password="x", is_staff=True, is_superuser=True)
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.docker = FakeDocker(
            FakeContainer("a" * 64, "alice-desk", f"{GUI}:latest", owner=self.alice.id),
            FakeContainer("b" * 64, "bob-desk", GUI, owner=self.bob.id),
            FakeContainer("c" * 64, "old-desk", GUI),  # from before ownership existed
            FakeContainer("d" * 64, "traefik", "traefik:v3.7", owner=self.alice.id),  # not a desktop
        )
        patcher = mock.patch("xterm.access.docker_client", return_value=self.docker)
        patcher.start()
        self.addCleanup(patcher.stop)

    def client_for(self, user):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_for(user)}")
        return client

    def visible(self, user):
        res = self.client_for(user).get("/dashboard/api/containers")
        self.assertEqual(res.status_code, 200)
        return sorted(c["name"] for c in res.json()["containers"])

    def test_users_only_see_their_own_desktops(self):
        self.assertEqual(self.visible(self.alice), ["alice-desk"])
        self.assertEqual(self.visible(self.bob), ["bob-desk"])
        self.assertEqual(self.visible(self.admin), ["alice-desk", "bob-desk", "old-desk"])

    def test_admins_see_the_owner(self):
        res = self.client_for(self.admin).get("/dashboard/api/containers").json()["containers"]
        owners = {c["name"]: c["owner"] for c in res}
        self.assertEqual(owners, {"alice-desk": "alice", "bob-desk": "bob", "old-desk": None})

    def test_other_desktops_answer_404(self):
        cases = [(self.bob, "a" * 64), (self.alice, "b" * 64), (self.alice, "c" * 64),
                 (self.alice, "d" * 64), (self.admin, "d" * 64)]
        for user, cid in cases:
            client = self.client_for(user)
            self.assertEqual(client.get(f"/dashboard/api/console/shell/{cid}").status_code, 404, (user, cid))
            res = client.post("/dashboard/api/containers/control", {"cmd": "stop", "id": cid}, format="json")
            self.assertEqual(res.status_code, 404, (user, cid))

    def test_owner_and_admin_can_act(self):
        task = mock.Mock(**{"delay.return_value.id": "job-1"})
        with mock.patch.dict("xterm.views.CONTROL_TASKS", {"stop": task}), \
                mock.patch("xterm.views.send_notification_to_group") as notify:
            for user in (self.alice, self.admin):
                res = self.client_for(user).post(
                    "/dashboard/api/containers/control", {"cmd": "stop", "id": "a" * 64}, format="json")
                self.assertEqual(res.status_code, 200)
        task.delay.assert_called_with("a" * 64, self.alice.id)
        self.assertEqual(notify.call_args.args[1], self.alice.id)  # WAITING goes to the owner
        self.assertEqual(self.client_for(self.alice).get(f"/dashboard/api/console/shell/{'a' * 64}").status_code, 200)

    def test_only_admins_create_privileged_containers(self):
        body = {"container_name": "desk", "ssh": "2201", "user": "u", "password": "p",
                "vnc_password": "v", "root_password": "r", "privileged": True}
        res = self.client_for(self.alice).post("/dashboard/api/container/new", body, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"], "Only admins can create privileged containers")
        with mock.patch("xterm.views.run_image_task") as run, \
                mock.patch("xterm.views.is_port_used_by_container", return_value=False), \
                mock.patch("xterm.views.check_port_in_use", return_value=False), \
                mock.patch("xterm.views.is_linux", return_value=False):
            run.delay.return_value.id = "job-2"
            res = self.client_for(self.admin).post("/dashboard/api/container/new", body, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(run.delay.call_args.kwargs["owner_id"], self.admin.id)
        self.assertTrue(run.delay.call_args.kwargs["privileged"])

    def test_new_desktops_are_labelled_with_their_owner(self):
        from xterm.task import run_image_task
        with mock.patch("xterm.task.send_notification_to_group") as notify:
            run_image_task(ports={}, volumes={}, environment={}, name="carol", owner_id=self.bob.id)
        image, kwargs = self.docker.created[0]
        self.assertEqual(image, GUI)
        self.assertEqual(kwargs["labels"][access.OWNER_LABEL], str(self.bob.id))
        self.assertEqual(notify.call_args.args[1], self.bob.id)

    def test_port_helpers_need_a_login(self):
        self.assertEqual(APIClient().get("/dashboard/api/ports?count=1").status_code, 401)


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class WebSocketPermissionsTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", password="x", is_staff=True, is_superuser=True)
        self.alice = User.objects.create_user("alice", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.docker = FakeDocker(FakeContainer("a" * 64, "alice-desk", GUI, owner=self.alice.id))
        patcher = mock.patch("xterm.access.docker_client", return_value=self.docker)
        patcher.start()
        self.addCleanup(patcher.stop)

    @staticmethod
    def token_protocol(user):
        return "token." + token_for(user)  # as frontend/lib/wsProtocols.ts builds it

    async def communicator(self, path, protocols):
        from backend.asgi import application
        comm = WebsocketCommunicator(application, path, subprotocols=protocols)
        connected, detail = await comm.connect()
        return comm, connected, detail

    async def test_console_refuses_someone_elses_desktop(self):
        comm, connected, _ = await self.communicator(
            "/ws/console/", [self.token_protocol(self.bob), "container." + "a" * 64])
        self.assertTrue(connected)
        await comm.send_json_to({"action": "shell", "payload": {"Id": "a" * 64}})
        closed = await comm.receive_output()
        self.assertEqual(closed, {"type": "websocket.close", "code": 4004})
        await comm.disconnect()

    async def test_console_refuses_a_bad_token(self):
        comm, connected, code = await self.communicator("/ws/console/", ["token.nope", "container.x"])
        self.assertFalse(connected)
        self.assertEqual(code, 4001)

    async def test_notifications_reach_only_the_owner_and_admins(self):
        from xterm.consumers import send_notification_to_group
        sockets = {}
        for user in (self.alice, self.bob, self.admin):
            comm, connected, subprotocol = await self.communicator(
                "/ws/notifications/", ["notifications", self.token_protocol(user)])
            self.assertTrue(connected)
            self.assertEqual(subprotocol, "notifications")
            sockets[user.username] = comm
        await sync_to_async(send_notification_to_group)({"action": "STOPPED", "details": "x"}, self.alice.id)
        for name in ("alice", "admin"):
            msg = await sockets[name].receive_json_from()
            self.assertEqual(msg["message"]["action"], "STOPPED")
        self.assertTrue(await sockets["bob"].receive_nothing())
        for comm in sockets.values():
            await comm.disconnect()

    async def test_notifications_need_a_login(self):
        _, connected, code = await self.communicator("/ws/notifications/", ["notifications"])
        self.assertFalse(connected)
        self.assertEqual(code, 4001)

    async def test_two_digit_user_ids_connect(self):
        # Their base64-encoded tokens ended in "=", so the browser refused to open the socket at all.
        carol = await sync_to_async(User.objects.create_user)("carol", password="x", id=10)
        comm, connected, subprotocol = await self.communicator(
            "/ws/notifications/", ["notifications", self.token_protocol(carol)])
        self.assertTrue(connected)
        self.assertEqual(subprotocol, "notifications")
        await comm.disconnect()


class TokenSubprotocolTest(SimpleTestCase):
    def test_every_user_id_gives_a_subprotocol_browsers_accept(self):
        # Base64-encoding the JWT broke user ids 10-99 ("=" padding); the JWT itself is always valid.
        for user_id in range(1, 1001):
            jwt = str(AccessToken.for_user(User(id=user_id, username=f"user{user_id}")))
            protocol = "token." + jwt
            self.assertRegex(protocol, SUBPROTOCOL, f"user id {user_id}")
            self.assertEqual(token_from_subprotocols(["notifications", protocol]), jwt)

    def test_missing_or_empty_token(self):
        self.assertIsNone(token_from_subprotocols(["notifications"]))
        self.assertIsNone(token_from_subprotocols(["token."]))
        self.assertIsNone(token_from_subprotocols(None))


class ChannelLayerTimeoutTest(SimpleTestCase):
    def test_redis_reads_outlast_the_layers_longest_wait(self):
        # redis-py 8 closes reads after 5 s by default, exactly as long as the layer blocks waiting for
        # a message, so every WebSocket dropped after about 5 s. Check what redis-py will really get.
        from channels_redis.core import RedisChannelLayer
        from channels_redis.utils import create_pool, decode_hosts
        from django.conf import settings

        for host in decode_hosts(settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"]):
            # make_connection() builds the connection redis-py would use, without connecting
            timeout = create_pool(host).make_connection().socket_timeout
            self.assertIsNotNone(timeout, "a read with no timeout never notices a dead Redis")
            self.assertGreater(timeout, RedisChannelLayer.brpop_timeout)
