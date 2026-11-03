"""Account API for the dashboard, built on django.contrib.auth's User.

- Everyone: GET me, POST me/password (change your own password).
- Admins: GET/POST users, PATCH users/<id> (role, active, email), POST users/<id>/password.

Roles map onto Django's own flags: "admin" means is_staff and is_superuser (so the Django admin site
agrees), "disabled" means is_active=False (Django and SimpleJWT already refuse those at login and on
every authenticated request). Admins can't demote or disable themselves, so the last admin can't
lock everybody out. Same routes and JSON as the Rust manager, so both dashboards share one frontend.
"""
from django.contrib.auth import password_validation
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from xterm.access import is_admin


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_admin(request.user))


def account(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or None,
        "is_admin": is_admin(user),
        "is_active": user.is_active,
        "created_at": user.date_joined.isoformat(),
    }


def set_admin(user, admin):
    user.is_staff = user.is_superuser = bool(admin)


def error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({"error": message}, status=code)


def password_problem(password, user=None):
    """Django's password validators (settings.AUTH_PASSWORD_VALIDATORS) as one message, or None."""
    try:
        password_validation.validate_password(password, user)
    except ValidationError as e:
        return " ".join(e.messages)
    return None


class MeView(APIView):
    def get(self, request):
        return Response(account(request.user))


class MyPasswordView(APIView):
    def post(self, request):
        user = request.user
        if not user.check_password(request.data.get("current_password", "")):
            return error("The current password is wrong.")
        new_password = request.data.get("new_password", "")
        problem = password_problem(new_password, user)
        if problem:
            return error(problem)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class UsersView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response([account(u) for u in User.objects.order_by("id")])

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        if not username:
            return error("Username is required.")
        user = User(username=username, email=(request.data.get("email") or "").strip())
        set_admin(user, request.data.get("is_admin", False))
        password = request.data.get("password", "")
        problem = password_problem(password, user)
        if problem:
            return error(problem)
        user.set_password(password)
        try:
            user.save()
        except IntegrityError:
            return error("That username is already taken.")
        return Response(account(user), status=status.HTTP_201_CREATED)


class UserView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        changes = request.data
        if user.id == request.user.id and (changes.get("is_admin") is False or changes.get("is_active") is False):
            return error("You can't remove your own admin role or disable your own account.")
        if "is_admin" in changes:
            set_admin(user, changes["is_admin"])
        if "is_active" in changes:
            user.is_active = bool(changes["is_active"])
        if "email" in changes:
            user.email = (changes["email"] or "").strip()
        user.save()
        return Response(account(user))


class UserPasswordView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        new_password = request.data.get("new_password", "")
        problem = password_problem(new_password, user)
        if problem:
            return error(problem)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)
