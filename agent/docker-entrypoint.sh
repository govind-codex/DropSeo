#!/bin/sh
set -eu

# Webcmd's managed Chromium uses a display even in background window mode.
# Start the virtual display independently so it can never block the HTTP worker.
Xvfb "${DISPLAY:-:99}" -screen 0 1280x760x24 -nolisten tcp &

exec node agent/server.mjs
