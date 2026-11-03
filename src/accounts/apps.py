from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """User management for the dashboard, on top of django.contrib.auth (no models of its own)."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
