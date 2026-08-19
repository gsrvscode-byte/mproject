#!/bin/bash
set -e

# The mounted /var/run/docker.sock belongs to a "docker"
# group on the HOST, with some host-specific GID. Inside this
# container that GID may not exist yet, so we create a
# matching group and add the jenkins user to it — otherwise
# `docker` commands inside pipelines fail with
# "permission denied" even though the socket is mounted.

if [ -S /var/run/docker.sock ]; then

    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)

    if ! getent group docker > /dev/null 2>&1; then
        groupadd -g "$DOCKER_GID" docker
    fi

    usermod -aG docker jenkins

fi

# Drop from root to the jenkins user for the actual Jenkins
# process, same as the base image normally does on its own.
exec su -s /bin/bash jenkins -c "/usr/local/bin/jenkins.sh $*"
