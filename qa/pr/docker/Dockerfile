FROM mcr.microsoft.com/playwright:v1.49.1-noble

# GitHub へのログイン（初回のみ）を noVNC で画面表示するためのパッケージ
RUN apt-get update \
  && apt-get install -y --no-install-recommends xvfb x11vnc fluxbox novnc websockify \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN npm init -y > /dev/null && npm install --no-audit --no-fund playwright-core@1.49.1

COPY scripts/ /app/scripts/
COPY entrypoint.sh /app/entrypoint.sh

ENTRYPOINT ["bash", "/app/entrypoint.sh"]
