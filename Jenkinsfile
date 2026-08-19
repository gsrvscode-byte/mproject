pipeline {

    agent any

    options {
        timestamps()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Start Test Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "STARTING TEST DEPENDENCIES"
                    echo "=========================================="

                    docker compose up -d mysql mailhog

                    echo ""
                    echo "Docker Compose status:"
                    docker compose ps

                    echo ""
                    echo "Waiting for MySQL..."

                    MYSQL_CONTAINER=$(docker compose ps -q mysql)

                    if [ -z "$MYSQL_CONTAINER" ]; then
                        echo "ERROR: MySQL container was not created."
                        docker compose ps
                        exit 1
                    fi

                    echo "MySQL container ID: $MYSQL_CONTAINER"

                    for i in $(seq 1 30); do

                        STATUS=$(docker inspect \
                            -f '{{.State.Health.Status}}' \
                            "$MYSQL_CONTAINER" 2>/dev/null || echo "starting")

                        echo "Attempt $i/30 - MySQL health: $STATUS"

                        if [ "$STATUS" = "healthy" ]; then
                            echo "MySQL is healthy."
                            break
                        fi

                        if [ "$STATUS" = "unhealthy" ]; then
                            echo "ERROR: MySQL is unhealthy."

                            echo ""
                            echo "========== MYSQL LOGS =========="

                            docker compose logs mysql --tail 100

                            exit 1
                        fi

                        sleep 2
                    done

                    STATUS=$(docker inspect \
                        -f '{{.State.Health.Status}}' \
                        "$MYSQL_CONTAINER")

                    if [ "$STATUS" != "healthy" ]; then

                        echo ""
                        echo "ERROR: MySQL did not become healthy in time."

                        echo ""
                        echo "========== MYSQL LOGS =========="

                        docker compose logs mysql --tail 100

                        exit 1
                    fi

                    echo ""
                    echo "=========================================="
                    echo "MYSQL IS HEALTHY"
                    echo "MAILHOG IS RUNNING"
                    echo "=========================================="
                '''
            }
        }

        stage('Build API Image') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "BUILDING API IMAGE"
                    echo "=========================================="

                    docker compose build api

                    echo ""
                    echo "API image build completed."
                '''
            }
        }

        stage('Run Tests') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "RUNNING TESTS"
                    echo "=========================================="

                    docker compose run --rm api npm test -- --runInBand

                    echo ""
                    echo "Tests completed successfully."
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -e

                    echo "=========================================="
                    echo "DEPLOYING APPLICATION"
                    echo "=========================================="

                    docker compose up -d --build api nginx

                    echo ""
                    echo "=========================================="
                    echo "APPLICATION STATUS"
                    echo "=========================================="

                    docker compose ps

                    echo ""
                    echo "Deployment completed successfully."
                '''
            }
        }
    }

    post {

        success {
            echo ""
            echo "=========================================="
            echo "BUILD SUCCESSFUL"
            echo "=========================================="
            echo "Application deployed successfully."
        }

        failure {
            echo ""
            echo "=========================================="
            echo "BUILD FAILED"
            echo "=========================================="
            echo "Check the failed stage logs above."
        }

        always {
            sh '''
                echo ""
                echo "=========================================="
                echo "FINAL DOCKER STATUS"
                echo "=========================================="

                docker compose ps || true
            '''
        }
    }
}