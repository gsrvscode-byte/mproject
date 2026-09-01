# Docker Stack: PostgreSQL + Redis + RabbitMQ + Node App + MailHog + Tools

This stack spins up:

- **postgres** – PostgreSQL 16 with a preconfigured user/password/database (via `.env`)
- **redis** – Redis 7
- **rabbitmq** – RabbitMQ 3 with the management UI enabled
- **mailhog** – a dummy local SMTP server + web UI for catching "sent" emails
  without actually delivering them anywhere (great for testing registration
  emails locally)
- **app** – a Node.js (Express) app with full Redis CRUD, a Postgres-backed
  `/register` endpoint, and RabbitMQ publishing (`app/index.js`)
- **worker** – a background worker that consumes the `user_registered` queue
  from RabbitMQ and sends a welcome email through MailHog (`app/worker.js`)
- **tools** – a small Alpine container with `curl`, `psql`, `redis-cli`, `nc`, and `jq`
  installed, kept alive so you can `exec` into it and test connectivity to the
  other services

## 1. Configure credentials

Edit `.env` to change usernames, passwords, ports, etc. Defaults:

| Service   | User      | Password      | Port (host) |
|-----------|-----------|---------------|-------------|
| Postgres  | appuser   | apppassword   | 5432        |
| Redis     | —         | —             | 6379        |
| RabbitMQ  | appuser   | apppassword   | 5672 (AMQP), 15672 (mgmt UI) |

## 2. Start the stack

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

## 3. Test connectivity from the tools container

```bash
docker compose exec tools sh
```

Inside the container:

```bash
# Postgres
psql "postgresql://appuser:apppassword@postgres:5432/appdb" -c "SELECT 1;"

# Redis
redis-cli -h redis ping

# RabbitMQ management API (curl)
curl -u appuser:apppassword http://rabbitmq:15672/api/overview
```

## 4. Node app endpoints

Once the stack is up, the app is available at http://localhost:3000
(port configurable via `APP_PORT` in `.env`):

| Endpoint          | What it does                                                |
|-------------------|--------------------------------------------------------------|
| `GET /`           | Lists available endpoints                                    |
| `GET /health`     | Basic liveness check                                          |
| `GET /pg`         | Creates a `visits` table, inserts a row, returns the count    |
| `POST /redis`     | **Create** a key: body `{ "key": "foo", "value": "bar" }` (409 if it exists) |
| `GET /redis`      | **Read all** keys and values                                  |
| `GET /redis/:key` | **Read one** key                                               |
| `PUT /redis/:key` | **Update** an existing key: body `{ "value": "new" }` (404 if missing) |
| `DELETE /redis/:key` | **Delete** a key                                            |
| `GET /rabbitmq`   | Publishes a test message to the `app_events` queue             |
| `POST /register`  | Registers a user in Postgres and publishes to RabbitMQ (see below) |

### Redis CRUD examples

```bash
curl -X POST http://localhost:3000/redis -H "Content-Type: application/json" \
  -d '{"key":"foo","value":"bar"}'

curl http://localhost:3000/redis/foo

curl -X PUT http://localhost:3000/redis/foo -H "Content-Type: application/json" \
  -d '{"value":"updated"}'

curl http://localhost:3000/redis

curl -X DELETE http://localhost:3000/redis/foo
```

### Registration flow (Postgres → RabbitMQ → worker → MailHog)

```bash
curl -X POST http://localhost:3000/register -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"secret123"}'
```

What happens:
1. `app` hashes the password and inserts the user into the `users` table in Postgres.
2. `app` publishes a message to the `user_registered` queue in RabbitMQ.
3. `worker` consumes that message and sends a "welcome" email via MailHog's
   dummy SMTP server (no real email is sent — nothing leaves your machine).
4. Open **http://localhost:8025** (MailHog web UI) to see the caught email.

The app source lives in `app/index.js`; the worker lives in `app/worker.js`.
Re-run `docker compose up -d --build app worker` after editing either file.

## 5. RabbitMQ management UI

Open http://localhost:15672 in your browser (or the host you're running
Docker on) and log in with the credentials from `.env`.

## 6. Stop / remove

```bash
docker compose down          # stop containers, keep data volumes
docker compose down -v       # stop containers AND delete data volumes
```

## Notes

- All services share the `backend` bridge network, so containers can reach
  each other by service name (`postgres`, `redis`, `rabbitmq`).
- Data is persisted in named volumes (`postgres_data`, `redis_data`,
  `rabbitmq_data`) so it survives `docker compose down` (without `-v`).
- Health checks are configured for all three data services; the `tools`
  container waits for them to be healthy before starting.
- MailHog is a **dummy** mail server for local dev only — it catches every
  "sent" email and shows it at http://localhost:8025 instead of actually
  delivering it. Swap the `mailhog` service / SMTP settings for a real
  provider (SendGrid, SES, etc.) before going to production.
