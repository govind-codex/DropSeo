FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    DISPLAY=:99 \
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
    && chown -R node:node /app/outputs /data \
    && chmod +x /app/agent/docker-entrypoint.sh

USER node

EXPOSE 8788

CMD ["/app/agent/docker-entrypoint.sh"]
