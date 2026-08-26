# Employee CRUD API — Jenkins CI/CD Learning Project

A small, beginner-friendly project for learning how **Jenkins CI/CD** works end-to-end, on top of
a simple Node.js + Express + PostgreSQL + Docker application.

---

## 1. Project Structure

```
employee-crud/
├── src/
│   ├── config/db.js                 # PostgreSQL connection pool
│   ├── controllers/employeeController.js
│   ├── routes/employeeRoutes.js
│   ├── app.js                       # Express app + error handling
│   └── server.js                    # Entry point
├── db/init.sql                      # Creates the employees table
├── tests/employee.test.js           # Jest + Supertest API tests
├── Dockerfile
├── docker-compose.yml
├── Jenkinsfile
├── package.json
├── .env.example
└── .gitignore
```

---

## 2. Architecture

```
Postman / curl
      ↓
  localhost:5000
      ↓
 Node.js Container  (api)
      ↓
  Docker Network
      ↓
PostgreSQL Container (postgres)
      ↓
   employee_db
```

**CI/CD flow (the real end-to-end version):**

```
Developer changes code
      ↓ git add / git commit / git push
GitHub
      ↓ webhook or poll
Jenkins trigger
      ↓
Jenkins checkout
      ↓ npm ci
      ↓ npm test
      ↓ docker build
      ↓ docker compose up
PostgreSQL container
      ↓
Node.js container
      ↓
Health check
      ↓
Deployment successful
```

---

## 3. Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Git + a GitHub account
- Jenkins (we'll install this in Phase 8 — not needed until then)

---

## 4. Quick Setup

```bash
git clone <this-repo>
cd employee-crud
npm install
cp .env.example .env
```

Full run (Docker):

```bash
docker compose up --build
curl http://localhost:5000/health
```

---

## Understanding Docker Networking (read this before Phase 3)

This is the concept the project is specifically built to teach, so it gets its own section
up front.

**The rule:** `localhost` inside a container refers to *that container itself*, not to your
machine and not to other containers.

- When the Node.js app runs **directly on your laptop** (`npm run dev`) and Postgres runs in
  Docker with its port **published** (`ports: ["5432:5432"]`), your laptop can reach Postgres at
  `localhost:5432` — Docker forwarded that port from the container onto your machine's own
  network interface.

- When the Node.js app **also** runs inside a container (as it does from Phase 4 onward), that
  container has its **own isolated network namespace**. If the app tries to connect to
  `localhost:5432` from inside the `api` container, it's asking "is Postgres running inside
  *this same api container*?" — and it isn't, so the connection is refused.

- Docker Compose solves this by creating a **private Docker network** shared by every service in
  the same `docker-compose.yml`, and registering each service's name (`api`, `postgres`) as a
  DNS hostname on that network. So from inside the `api` container, the hostname `postgres`
  resolves to the Postgres container's internal IP address on that shared network.

That's why `.env`/`docker-compose.yml` set:

```
DATABASE_HOST=postgres      # when API runs in Docker
DATABASE_HOST=localhost     # when API runs on your host machine, Postgres port published
```

---

## Core Concepts, Explained for a Node.js Developer

| Term | Plain explanation |
|---|---|
| **Docker image** | A read-only template/snapshot — like a class in OOP. Built once from a Dockerfile (`docker build`). |
| **Docker container** | A running instance of an image — like an object created from that class (`docker run`). You can run many containers from one image. |
| **Docker network** | A private virtual network Docker creates so containers can talk to each other by service name, isolated from your host's network. |
| **Docker volume** | A folder Docker manages outside the container's filesystem, so data (like Postgres's actual database files) survives even if the container is deleted and recreated. |
| **Docker Compose** | A tool that reads one YAML file (`docker-compose.yml`) and starts/stops/networks multiple containers together as one unit, instead of running several long `docker run` commands by hand. |
| **Jenkins** | An automation server. It runs a sequence of shell commands (defined in a Jenkinsfile) automatically whenever your code changes — it does not run your app itself. |
| **Jenkins agent** | The machine (or container) that actually executes a pipeline's steps. `agent any` means "run this on any available agent." |
| **Jenkins workspace** | A folder on the agent's disk where Jenkins checks out your code and runs commands for a specific job — like a temporary working directory per build. |
| **Jenkins pipeline** | The full definition of your CI/CD process: an ordered set of stages (Checkout, Test, Build, Deploy, ...). |
| **Jenkinsfile** | The text file (checked into your repo) that defines the pipeline as code, so your CI/CD process is version-controlled just like your app. |
| **CI (Continuous Integration)** | Automatically building and testing every code change, so bugs are caught immediately instead of at release time. |
| **CD (Continuous Delivery/Deployment)** | Automatically packaging and deploying code that passed CI, so releases happen reliably and repeatably instead of by hand. |
| **Webhook** | GitHub proactively sends an HTTP POST to Jenkins the instant you push — "hey, something changed, go build it." Requires Jenkins to be reachable from the internet. |
| **Poll SCM** | Instead of waiting to be told, Jenkins periodically checks GitHub itself ("has anything changed since I last checked?") on a schedule (e.g. every minute). Works even if Jenkins isn't publicly reachable — the trade-off is a small delay instead of instant triggering. |

---

## Learning Path: Phase by Phase

### Phase 1 — Node.js Express CRUD (no Docker)
**What:** `src/app.js`, `src/server.js`, `/health` route only.
**Why:** Confirm Express boots before adding any database or infrastructure.
**Files:** `src/app.js`, `src/server.js`.
**Run:** `npm run dev`
**Test:** `curl http://localhost:5000/health` → `{"status":"OK"}`
**Common errors:** `EADDRINUSE` (port 5000 already used) → change `PORT` in `.env` or stop the other process.

### Phase 2 — Add PostgreSQL
**What:** Install Postgres locally OR run it in a single standalone container
(`docker run --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`), then add
`src/config/db.js`, `db/init.sql`, and the five CRUD handlers in `employeeController.js` +
`employeeRoutes.js`.
**Why:** Get real persistence working with plain SQL before introducing any containers for the
API itself.
**Files:** `src/config/db.js`, `src/controllers/employeeController.js`, `src/routes/employeeRoutes.js`, `db/init.sql`.
**Run:** create the `employee_db` database and run `db/init.sql` against it manually, then `npm run dev`.
**Test:** run the `curl` commands in section "CRUD API Examples" below.
**Common errors:** `ECONNREFUSED` → Postgres isn't running or wrong `DATABASE_HOST`/port in `.env`.

### Phase 3 — Dockerize PostgreSQL
**What:** Add the `postgres` service to `docker-compose.yml` (image, env vars, volume, healthcheck), keep the API running on your host with `DATABASE_HOST=localhost`.
**Why:** Learn to containerize the database in isolation, and see the "published port" case of
Docker networking (Postgres in Docker, app on host) before adding the app to Docker too.
**Files:** `docker-compose.yml` (postgres service only, comment out/ignore the api service for now), `.env` (`DATABASE_HOST=localhost`).
**Run:** `docker compose up postgres`
**Test:** `docker compose exec postgres psql -U postgres -d employee_db -c "\dt"` → should list `employees`.
**Common errors:** If you previously ran Postgres locally on 5432, you'll get a port conflict — stop the local Postgres service or change the published port.

### Phase 4 — Dockerize Node.js
**What:** Add the `Dockerfile`.
**Why:** Package the API itself as a portable image.
**Files:** `Dockerfile`.
**Run:** `docker build -t employee-api:latest .` then
`docker run -p 5000:5000 --env-file .env employee-api:latest` — this will actually **fail to
reach Postgres** if `.env` still says `DATABASE_HOST=localhost`, which is the exact lesson: the
containerized API can no longer see your host's `localhost`. That's what Phase 5 fixes properly.
**Test:** `docker images` shows `employee-api:latest`.
**Common errors:** `ECONNREFUSED` when calling the API — expected here, see above; don't debug it
yet, Phase 5 resolves it correctly via Docker Compose networking.

### Phase 5 — Create docker-compose.yml (both services)
**What:** Full `docker-compose.yml` with both `api` and `postgres` services, `DATABASE_HOST=postgres`, `depends_on: condition: service_healthy`, and named volume for Postgres data.
**Why:** This is where Docker networking "clicks" — both containers join the same Compose
network, and `postgres` resolves as a hostname.
**Files:** `docker-compose.yml`, `.env` used only by `docker compose` via `env_file`, but note
the compose file **overrides** `DATABASE_HOST` to `postgres` explicitly in `environment:` so it
works correctly regardless of what's in your local `.env`.
**Run:** `docker compose up --build`
**Test:** `curl http://localhost:5000/api/employees` → `[]`
**Common errors:** If the api container starts before Postgres is ready, you'd normally get
`ECONNREFUSED` — the `healthcheck` + `depends_on: condition: service_healthy` in this project
prevents that by making `api` wait.

### Phase 6 — Test the complete Docker application
**What:** No new files — exercise the full CRUD flow against the Dockerized stack.
**Why:** Confirm everything really works together before adding automated tests.
**Test:** run every command in "CRUD API Examples" below, in order, against `http://localhost:5000`.

### Phase 7 — Add Jest/Supertest tests
**What:** `tests/employee.test.js`.
**Why:** Automate what you just did by hand in Phase 6, so Jenkins can verify it on every push.
**Files:** `tests/employee.test.js`, `jest`/`supertest` added to `package.json`.
**Run:** with Postgres reachable (`docker compose up postgres` or the full stack),
`DATABASE_HOST=localhost npm test` (if Postgres's port is published to your host).
**Test/expected output:** Jest reports 5 passing tests.
**Common errors:** Tests hang or fail with `ECONNREFUSED` → Postgres isn't running/reachable from
wherever `npm test` executes; `Jest did not exit` warning → make sure `pool.end()` runs in
`afterAll` (already handled in this project).

### Phase 8 — Add Jenkins
**What:** Install Jenkins itself. Easiest for learning: run Jenkins in Docker.
```bash
docker run -d --name jenkins -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkinsci/blueocean
```
Mounting `/var/run/docker.sock` lets Jenkins run `docker build` / `docker compose up` itself
(this is what lets a Jenkins *container* control Docker on the host — a common but slightly
advanced pattern worth knowing exists, not something you need to fully master yet).
**Why:** Get the Jenkins server running before writing a pipeline against it.
**Test:** open `http://localhost:8080`, complete the setup wizard using the initial admin
password (`docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`).
**Common errors:** "docker: command not found" inside the Jenkins container → install the Docker
CLI in the Jenkins image, or use a Jenkins image that already includes it (`jenkinsci/blueocean`
does).

### Phase 9 — Create the Jenkinsfile
**What:** `Jenkinsfile` with the six stages (Checkout, Install, Test, Docker Build, Deploy,
Health Check).
**Why:** Define the pipeline as code, checked into the repo, instead of clicking around Jenkins's
UI to configure each step.
**Files:** `Jenkinsfile` (see full explanation of each stage in the file's own comments).
**Test:** validate syntax by opening `http://localhost:8080/pipeline-syntax/` or just proceeding
to Phase 10 and reading the build log.

### Phase 10 — Run the complete CI/CD pipeline
**What:** Push this repo to GitHub, then create and run a Jenkins Pipeline job pointed at it (see
next section for exact steps).
**Why:** See the entire flow work end-to-end, triggered by a real `git push`.
**Test/expected output:** Jenkins's "Console Output" shows all six stages passing green, ending
with a successful `curl http://localhost:5000/health` response.
**Common errors:** see "Common Errors" table below.

---

## Pushing This Project to GitHub

```bash
git init
git add .
git commit -m "initial employee CRUD application"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

---

## Setting Up the Jenkins Pipeline Job

1. Jenkins dashboard → **New Item** → name it, choose **Pipeline** → OK.
2. Under **Pipeline**, set:
   - **Definition:** `Pipeline script from SCM`
   - **SCM:** `Git`
   - **Repository URL:** your GitHub repo URL
   - **Branch Specifier:** `*/main`
   - **Script Path:** `Jenkinsfile`
3. Save, then **Build Now** to run it manually the first time.

### How Jenkins detects changes: Webhook vs. Poll SCM

**GitHub Webhook** — GitHub calls Jenkins directly the instant you push. Fast (near-instant), but
requires Jenkins to be reachable from the public internet at a real URL GitHub can send a POST
request to.

**Poll SCM** — Jenkins is instead configured with a cron-like schedule (e.g. `H/1 * * * *` =
roughly every minute) and periodically asks GitHub "anything new since last time?" itself. Slower
(up to the poll interval), but works even when Jenkins is only reachable on your own machine.

**If Jenkins is running locally (this project's default setup):** GitHub's servers cannot reach
`localhost` on your machine — there is no public address for them to call. Your two practical
options are:
1. **Poll SCM** (simplest for learning — no extra setup, just a small delay).
2. **ngrok**, which creates a temporary public URL that tunnels to your local Jenkins
   (`ngrok http 8080`), so you can point a real GitHub webhook at that temporary URL to see
   instant triggering work. This is a testing/learning convenience — a real production Jenkins
   would have its own actual public URL instead of a tunnel.

---

## Dockerfile, Explained Line by Line

```dockerfile
FROM node:20                  # Start from an official image with Node.js 20 already installed
WORKDIR /app                  # All following commands run inside /app in the container
COPY package*.json ./         # Copy ONLY the manifest files first...
RUN npm ci --omit=dev         # ...so this install step is cached by Docker and only
                               # re-runs when dependencies actually change, not on every
                               # source code edit. --omit=dev skips devDependencies
                               # (jest, supertest) since they're not needed at runtime.
COPY . .                      # Now copy the rest of the application source code
EXPOSE 5000                   # Documents which port the container listens on (informational;
                               # doesn't actually publish the port — docker-compose.yml's
                               # "ports:" does that)
CMD ["node", "src/server.js"] # The command that runs when a container starts from this image
```

---

## CRUD API Examples

```bash
# Create
curl -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","department":"Engineering","salary":95000}'

# Get all
curl http://localhost:5000/api/employees

# Get one
curl http://localhost:5000/api/employees/1

# Update
curl -X PUT http://localhost:5000/api/employees/1 \
  -H "Content-Type: application/json" \
  -d '{"salary":101000}'

# Delete
curl -X DELETE http://localhost:5000/api/employees/1

# Health check
curl http://localhost:5000/health
```

---

## Useful PostgreSQL Commands

```bash
docker compose exec postgres psql -U postgres -d employee_db
```
```sql
\dt                     -- list tables
\d employees             -- describe the employees table
SELECT * FROM employees;
```

## Stopping / Restarting Docker

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers, DELETE data (fresh init.sql next time)
docker compose up            # restart
docker compose up --build    # rebuild the api image after code changes, then start
docker compose logs -f api   # follow API logs
```

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `ECONNREFUSED` connecting to Postgres from the `api` container | `DATABASE_HOST=localhost` used inside a container | Use `DATABASE_HOST=postgres` (Docker network service name) |
| Port 5432/5000 already in use | Something else is already bound to that port | Stop the other process, or change the published port in `docker-compose.yml` |
| `23505` / "already exists" on create/update | Duplicate email (unique constraint) | Use a different email |
| `400 Invalid ID format` | Non-numeric `:id` in URL | Use a real integer employee ID |
| Jest hangs after tests finish | Postgres pool never closed | Already handled via `pool.end()` in `afterAll` — if you copy this pattern elsewhere, don't forget it |
| Jenkins `Health Check` stage fails (`curl: (7) Failed to connect`) | Containers weren't up yet, or a previous stage failed silently | Check `docker compose ps` and the `Docker Compose Up` stage's log; increase the `sleep` before the health check if containers are slow to start |
| Jenkins can't run `docker` commands | Docker CLI/socket not available inside the Jenkins agent | Mount `/var/run/docker.sock` and use an image with the Docker CLI installed (see Phase 8) |

---

## Interview Questions Based on This Project

1. Why does `localhost` fail when both your Node.js app and PostgreSQL run in separate Docker
   containers, and what's the correct fix?
2. What's the difference between a Docker image and a Docker container?
3. Why does this project mount a named volume for Postgres but not for the API?
4. What does `depends_on: condition: service_healthy` do, and why isn't plain `depends_on`
   (without a condition) enough here?
5. Why does the Dockerfile copy `package*.json` and run `npm ci` before copying the rest of the
   source code?
6. What's the difference between `npm ci` and `npm install`, and why does CI prefer `npm ci`?
7. Explain, in your own words, what Jenkins actually does — and what it does *not* do.
8. What is a Jenkinsfile, and why check it into the same repo as the application code?
9. What's the difference between a GitHub webhook and Poll SCM for triggering a Jenkins build?
   Why would you use one over the other?
10. Why are parameterized queries (`$1, $2, ...`) used instead of string concatenation in the SQL
    here, and what specific attack does this prevent?
11. Walk through, stage by stage, what happens from `git push` to the API responding to a health
    check, in this project's pipeline.
12. If the `Test` stage in Jenkins fails, what happens to the rest of the pipeline, and why is
    that the correct behavior?
