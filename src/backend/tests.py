"""The ASGI entry point loads on its own, the way Daphne loads it in production."""
import os
import subprocess
import sys

from django.conf import settings
from django.test import SimpleTestCase


class AsgiEntryPointTest(SimpleTestCase):
    def test_daphne_can_import_the_application(self):
        # A fresh interpreter with nothing set up, like `daphne backend.asgi:application`. The test
        # runner has already configured Django, so importing it here would hide an ordering problem.
        env = {k: v for k, v in os.environ.items() if k != "DJANGO_SETTINGS_MODULE"}
        result = subprocess.run(
            [sys.executable, "-c", "import backend.asgi as a; print(type(a.application).__name__)"],
            cwd=settings.BASE_DIR, env=env, capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])
        self.assertIn("ProtocolTypeRouter", result.stdout)
