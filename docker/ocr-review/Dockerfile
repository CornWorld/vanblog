FROM node:20-slim

RUN apt-get update && apt-get install -y git python3 ca-certificates openssh-client --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /root/.ssh && ssh-keyscan github.com >> /root/.ssh/known_hosts

RUN npm install -g @alibaba-group/open-code-review

WORKDIR /workspace

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
