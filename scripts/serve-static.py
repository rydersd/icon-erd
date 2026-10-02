"""Serve the production export for local browser tests."""
import http.server

# Chromium requests many chunks concurrently. macOS can reset connections when
# the default five-connection listen backlog fills, leaving a partial app shell.
http.server.ThreadingHTTPServer.request_queue_size = 128
http.server.test(
    HandlerClass=lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(
        *args, directory="out", **kwargs
    ),
    ServerClass=http.server.ThreadingHTTPServer,
    bind="127.0.0.1",
    port=8010,
)
