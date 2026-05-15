import functools
import http.server
import os
import threading
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent
JS_DIR = REPO_ROOT / "js"
PORT = 8899


@pytest.fixture(scope="session", autouse=True)
def http_server():
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler,
        directory=str(JS_DIR),
    )
    handler.log_message = lambda *_: None  # silence request logs

    server = http.server.HTTPServer(("localhost", PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
