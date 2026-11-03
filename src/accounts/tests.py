"""Account rules: only admins manage accounts, changes take effect at once, nobody locks themselves
out, everyone can change their own password, and Django's password validators apply."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

PASSWORD = "Pf8!long-enough"


def client_for(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


def login(username, password):
    return APIClient().post("/api/auth/token", {"username": username, "password": password}, format="json")


class AccountsTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", password=PASSWORD, is_staff=True, is_superuser=True)
        self.alice = User.objects.create_user("alice", password=PASSWORD)
        self.bob = User.objects.create_user("bob", password=PASSWORD)

    def test_me(self):
        me = client_for(self.alice).get("/dashboard/api/me").json()
        self.assertEqual((me["username"], me["is_admin"], me["is_active"]), ("alice", False, True))
        self.assertTrue(client_for(self.admin).get("/dashboard/api/me").json()["is_admin"])

    def test_only_admins_manage_accounts(self):
        user = client_for(self.alice)
        self.assertEqual(user.get("/dashboard/api/users").status_code, 403)
        self.assertEqual(user.post("/dashboard/api/users", {"username": "x", "password": PASSWORD}, format="json").status_code, 403)
        self.assertEqual(user.patch(f"/dashboard/api/users/{self.bob.id}", {"is_active": False}, format="json").status_code, 403)
        self.assertEqual(user.post(f"/dashboard/api/users/{self.bob.id}/password", {"new_password": PASSWORD}, format="json").status_code, 403)
        names = [u["username"] for u in client_for(self.admin).get("/dashboard/api/users").json()]
        self.assertEqual(names, ["admin", "alice", "bob"])

    def test_admin_creates_users(self):
        admin = client_for(self.admin)
        weak = admin.post("/dashboard/api/users", {"username": "carol", "password": "123"}, format="json")
        self.assertEqual(weak.status_code, 400)
        self.assertIn("too short", weak.json()["error"])
        res = admin.post("/dashboard/api/users", {"username": "carol", "password": PASSWORD, "is_admin": True}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.json()["is_admin"])
        carol = User.objects.get(username="carol")
        self.assertTrue(carol.is_staff and carol.is_superuser)
        self.assertEqual(login("carol", PASSWORD).status_code, 200)
        dup = admin.post("/dashboard/api/users", {"username": "carol", "password": PASSWORD}, format="json")
        self.assertEqual(dup.json()["error"], "That username is already taken.")

    def test_disabling_takes_effect_at_once(self):
        alice = client_for(self.alice)
        res = client_for(self.admin).patch(f"/dashboard/api/users/{self.alice.id}", {"is_active": False}, format="json")
        self.assertEqual(res.json()["is_active"], False)
        self.assertEqual(alice.get("/dashboard/api/me").status_code, 401)
        self.assertEqual(login("alice", PASSWORD).status_code, 401)

    def test_roles_change_at_once(self):
        client_for(self.admin).patch(f"/dashboard/api/users/{self.bob.id}", {"is_admin": True}, format="json")
        self.assertEqual(client_for(self.bob).get("/dashboard/api/users").status_code, 200)
        client_for(self.admin).patch(f"/dashboard/api/users/{self.bob.id}", {"is_admin": False}, format="json")
        self.bob.refresh_from_db()
        self.assertFalse(self.bob.is_staff or self.bob.is_superuser)

    def test_admins_cannot_lock_themselves_out(self):
        admin = client_for(self.admin)
        for change in ({"is_admin": False}, {"is_active": False}):
            res = admin.patch(f"/dashboard/api/users/{self.admin.id}", change, format="json")
            self.assertEqual(res.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff and self.admin.is_active)

    def test_admin_resets_a_password(self):
        new = "New-pass-2026!"
        res = client_for(self.admin).post(f"/dashboard/api/users/{self.bob.id}/password", {"new_password": new}, format="json")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(login("bob", PASSWORD).status_code, 401)
        self.assertEqual(login("bob", new).status_code, 200)

    def test_users_change_their_own_password(self):
        bob = client_for(self.bob)
        wrong = bob.post("/dashboard/api/me/password", {"current_password": "nope", "new_password": "New-pass-2026!"}, format="json")
        self.assertEqual(wrong.status_code, 400)
        right = bob.post("/dashboard/api/me/password", {"current_password": PASSWORD, "new_password": "New-pass-2026!"}, format="json")
        self.assertEqual(right.status_code, 204)
        self.assertEqual(login("bob", "New-pass-2026!").status_code, 200)
