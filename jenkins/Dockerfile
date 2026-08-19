FROM jenkins/jenkins:lts-jdk17

USER root

# Install the Docker CLI + Compose v2 plugin so pipeline
# steps can run `docker` / `docker compose`. This does NOT
# install or run a Docker daemon inside this container —
# Jenkins talks to your host's existing Docker daemon
# through the socket mounted at runtime (see
# docker-compose.jenkins.yml). This is the standard
# "Docker-outside-of-Docker" pattern.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
        > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        docker-ce-cli docker-compose-plugin && \
    rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt

# Stay root at container start — entrypoint.sh fixes up
# docker-group permissions for the mounted socket, then
# drops down to the jenkins user itself before starting
# Jenkins.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
