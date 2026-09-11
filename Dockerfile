FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    CHROME_EXECUTABLE_PATH=/usr/bin/chromium \
    WEBCMD_WINDOW=background \
    WEBCMD_CONFIG_DIR=/data/webcmd \
    WEBCMD_CACHE_DIR=/data/webcmd-cache \
    WEBCMD_WORKFLOW_DIR=/data/workflows

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        fonts-liberation \
        fonts-noto-color-emoji \
        xauth \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node agent ./agent
RUN mkdir -p /app/outputs/runs /data/webcmd /data/webcmd-cache /data/workflows \
    && chown -R node:node /app/outputs /data

USER node

EXPOSE 8788

# Webcmd intentionally runs its managed browser in headed mode. Railway has no
# physical display, so provide an isolated virtual X display for that browser.
CMD ["xvfb-run", "-a", "-s", "-screen 0 1280x760x24 -nolisten tcp", "node", "agent/server.mjs"]
