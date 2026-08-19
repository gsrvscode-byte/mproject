pipeline {

    agent any

    // Jenkins itself now runs inside a container (see
    // jenkins/Dockerfile + docker-compose.jenkins.yml), with
    // the host's Docker socket mounted in. That means:
    //   - `docker` / `docker compose` here control the HOST's
    //     real Docker daemon (sibling containers), not a
    //     nested one.
    //   - Anything run directly via `sh` (like `npm`) executes
    //     INSIDE the Jenkins container, which does not have
    //     Node.js installed, and "localhost" there means the
    //     Jenkins container, not the host.
    // So npm/test steps run through `docker compose run`
    // against the api service instead of directly via `sh`.
    // This also means tests connect to mysql/mailhog by their
    // Docker service names (mysql, mailhog) — exactly the
    // DB_HOST / MAIL_HOST values already set in
    // docker-compose.yml's api service — not "localhost".

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Start Test Dependencies') {
            steps {
                sh 'docker compose up -d mysql mailhog'

                sh '''
                    echo "Waiting for MySQL to become healthy..."
                    for i in $(seq 1 30); do
                        status=$(docker inspect -f "{{.State.Health.Status}}" ecommerce-mysql 2>/dev/null || echo "starting")
                        if [ "$status" = "healthy" ]; then
                            echo "MySQL is healthy."
                            exit 0
                        fi
                        sleep 2
                    done
                    echo "MySQL did not become healthy in time."
                    docker logs ecommerce-mysql --tail 50
                    exit 1
                '''
            }
        }

        stage('Build API Image') {
            steps {
                // Builds the api service's image per
                // docker-compose.yml — this also runs
                // `npm install` inside the image build (per
                // the Dockerfile), so no separate "npm ci"
                // step is needed on the Jenkins side at all.
                sh 'docker compose build api'
            }
        }

        stage('Run Tests') {
            steps {
                // Runs the just-built api image as a one-off
                // container attached to the same Docker Compose
                // network as mysql/mailhog, so it can reach them
                // by service name. Environment vars (DB_HOST,
                // MAIL_HOST, etc) come from the api service
                // definition in docker-compose.yml already —
                // nothing to override here.
                sh 'docker compose run --rm api npm test'
            }
        }

        stage('Deploy') {
            steps {
                // Redeploys the full stack in place: mysql and
                // mailhog are reused if already healthy, api is
                // rebuilt (already built above, this is a no-op
                // rebuild) and scaled to 3 replicas, nginx starts
                // and load-balances across them.
                sh 'docker compose up -d --build --scale api=3'
            }
        }

    }

    post {

        // No teardown here — "Deploy" is the last stage and
        // its job is to leave the full stack running. See
        // earlier note in project history: a `down -v` here
        // would tear down (and wipe the DB volume of) the
        // stack you just deployed, on every single build.

        success {
            echo "Build #${env.BUILD_NUMBER} succeeded — stack redeployed."
        }

        failure {
            echo "Build #${env.BUILD_NUMBER} failed — check the stage logs above. The stack from the last successful build is untouched."
        }

    }

}
