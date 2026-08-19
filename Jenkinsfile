stage('Start Test Dependencies') {
    steps {
        sh '''
            set -e

            echo "=========================================="
            echo "STARTING TEST DEPENDENCIES"
            echo "=========================================="

            docker compose down --remove-orphans || true

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

            echo "MySQL container: $MYSQL_CONTAINER"

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
                    docker compose logs mysql --tail 100
                    exit 1
                fi

                sleep 2
            done

            STATUS=$(docker inspect \
                -f '{{.State.Health.Status}}' \
                "$MYSQL_CONTAINER")

            if [ "$STATUS" != "healthy" ]; then
                echo "ERROR: MySQL did not become healthy."
                docker compose logs mysql --tail 100
                exit 1
            fi

            echo ""
            echo "=========================================="
            echo "MYSQL IS HEALTHY"
            echo "=========================================="
        '''
    }
}