# Document Knowledge API

A beginner-friendly learning project that teaches how **PostgreSQL + pgvector + LangChain**
work together to build a simple semantic search / RAG (Retrieval-Augmented Generation) API,
built with plain Node.js + Express.

---

## 1. What This Project Teaches

- How to run CRUD APIs against PostgreSQL with plain SQL (via `pg`, no ORM).
- What an **embedding** is and how to generate one with an OpenAI model through **LangChain**.
- How **pgvector** stores vectors inside Postgres and lets you search by similarity using SQL.
- How to build a minimal **RAG** flow: question → retrieve relevant docs → ask an LLM to
  answer using those docs as context.
- How to wire all of this into Docker so it runs the same way on any machine.

Nothing here is hidden behind heavy abstractions — every SQL query and every LangChain call is
short enough to read in full, and this README explains what each one does.

---

## 2. Architecture

```
Client / Postman / curl
          ↓
   Node.js + Express  (REST API)
          ↓
      LangChain          (thin wrapper around the AI calls)
          ↓
    Embedding Model      (OpenAI text-embedding-3-small)
          ↓
  PostgreSQL + pgvector  (stores vectors, runs similarity search)
          ↓
  Vector Similarity Search
          ↓
   Relevant Documents
          ↓
        LLM              (OpenAI gpt-4o-mini, via LangChain)
          ↓
        Answer
```

**Concept glossary** (all commonly confused with each other):

| Term | What it actually is |
|---|---|
| **PostgreSQL** | A general-purpose relational database. Stores rows/tables. |
| **pgvector** | An extension that adds a `vector` column type + similarity operators to PostgreSQL. Turns Postgres into a vector database. |
| **Vector Database** | Any database that can store vectors and answer "which stored vectors are closest to this one?" efficiently. Postgres+pgvector is one; there are also dedicated ones (Pinecone, Qdrant, etc). |
| **Embedding Model** | An AI model that converts text into a vector (list of numbers) representing its meaning. |
| **LangChain** | A library that gives you a consistent interface for calling embedding models and LLMs, so you can swap providers without rewriting your app. It doesn't do the AI itself — OpenAI does. |
| **Vector Search** | The act of finding the nearest vectors to a query vector (e.g. via cosine distance). |
| **LLM** | A large language model (e.g. GPT-4o-mini) that generates text — used here to write the final answer. |
| **RAG** | "Retrieval-Augmented Generation" — instead of asking an LLM a question cold, you first *retrieve* relevant text (via vector search) and feed it to the LLM as context, so it can answer accurately about your own data. |

---

## 3. Prerequisites

- Node.js 20+ (only needed if running the API outside Docker)
- Docker + Docker Compose
- An OpenAI API key with access to embeddings + chat completions

---

## 4. Installation

```bash
git clone <this-repo>
cd project
npm install
```

## 5. Environment Setup

```bash
cp .env.example .env
```

Then edit `.env` and fill in:

```
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docsdb
OPENAI_API_KEY=sk-...
```

> Never commit `.env` — it's already in `.gitignore`.

---

## 6. Docker Setup

Bring up both containers (Postgres+pgvector, and the API):

```bash
docker compose up --build
```

- On first boot, Postgres automatically runs `db/init.sql`, which enables `pgvector` and
  creates the `documents` table.
- The API becomes available at `http://localhost:5000`.

Stop everything:

```bash
docker compose down
```

Stop everything **and wipe the database volume** (start completely fresh, re-running init.sql):

```bash
docker compose down -v
```

Restart without rebuilding:

```bash
docker compose up
```

View logs for just the API:

```bash
docker compose logs -f api
```

### Running the API on your host instead of in Docker (useful while developing)

```bash
docker compose up postgres   # Postgres only
npm run dev                  # API runs directly on your machine
```

In this mode, make sure `.env`'s `DATABASE_URL` uses `localhost`, not `postgres` (see comments
in `.env.example`).

---

## 7. How PostgreSQL + pgvector Works

Postgres normally has no concept of "similarity" between rows. pgvector adds:

1. A new column type, `vector(N)`, where `N` is a fixed number of dimensions (here, 1536 —
   the size OpenAI's `text-embedding-3-small` model returns).
2. Distance operators you can use directly in SQL:
   - `<->` Euclidean distance
   - `<#>` negative inner product
   - `<=>` cosine distance ← **this is the one we use**
3. Optional specialized indexes (HNSW, IVFFlat) for fast approximate search at large scale.

We enable it once, in `db/init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Do we need an HNSW/IVFFlat index here?** No. Those indexes trade a small amount of accuracy
for speed on large datasets (100k+ rows). For a learning project with a handful of documents, a
plain sequential scan over the `embedding` column is already fast (single-digit milliseconds)
and gives *exact* results. Adding an index here would add configuration complexity for zero
practical benefit — so `db/init.sql` deliberately leaves it out (with a comment explaining how
you'd add one later).

---

## 8. How LangChain Works (in this project)

LangChain is used in exactly two places, both in `src/services/embeddingService.js` and
`src/controllers/documentController.js`:

```js
// Embeddings
const embeddings = new OpenAIEmbeddings({ apiKey, model: "text-embedding-3-small" });
const vector = await embeddings.embedQuery(text);

// Chat / LLM
const chatModel = new ChatOpenAI({ apiKey, model: "gpt-4o-mini" });
const response = await chatModel.invoke(prompt);
```

That's it. LangChain isn't doing anything clever here — it's a thin, consistent wrapper around
OpenAI's HTTP API. The benefit: if you later want to try a different provider (Anthropic,
Cohere, a local model), you change these two constructors and nothing else in the app has to
change, because every other file just calls `embedText(...)` or uses the returned vector.

---

## 9. How Embeddings Work

```
"Node.js is a JavaScript runtime built on Chrome's V8 engine"
        ↓  (embedding model)
[0.0123, -0.0456, 0.0789, ..., 0.0021]   ← 1536 numbers
```

- The vector encodes *meaning*, not exact words. Two different sentences that mean similar
  things produce vectors that are close together in that 1536-dimensional space.
- We measure "close together" using **cosine similarity**: the cosine of the angle between two
  vectors. It ranges from `-1` (opposite meaning) to `1` (identical meaning), with `0` meaning
  unrelated. pgvector gives us the opposite quantity, cosine **distance** (`<=>`), so we compute
  `1 - distance` in SQL to get back to the more intuitive "higher is more similar" similarity
  score.

---

## 10. CRUD API Examples

**Create**

```bash
curl -X POST http://localhost:5000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"title":"Node.js Basics","content":"Node.js is a JavaScript runtime built on Chrome V8."}'
```

**Get all**

```bash
curl http://localhost:5000/api/documents
```

**Get one**

```bash
curl http://localhost:5000/api/documents/1
```

**Update**

```bash
curl -X PUT http://localhost:5000/api/documents/1 \
  -H "Content-Type: application/json" \
  -d '{"content":"Node.js is a JavaScript runtime built on the V8 engine, used for backend APIs."}'
```

**Delete**

```bash
curl -X DELETE http://localhost:5000/api/documents/1
```

---

## 11. Embedding API Example

```bash
curl -X POST http://localhost:5000/api/documents/1/embed
```

Response:

```json
{ "message": "Document 1 embedded successfully", "dimensions": 1536 }
```

Internally: `documentController.embedDocument` fetches the document's content → passes it to
`embeddingService.embedText()` (LangChain → OpenAI) → passes the resulting vector to
`vectorSearchService.storeEmbedding()`, which runs:

```sql
UPDATE documents SET embedding = $1::vector, updated_at = now() WHERE id = $2
```

---

## 12. Vector Search Example

```bash
curl "http://localhost:5000/api/search?query=backend%20javascript%20runtime"
```

Internally, this endpoint:
1. Embeds the query string the same way documents are embedded.
2. Runs:

```sql
SELECT
  id, title, content,
  1 - (embedding <=> $1::vector) AS similarity
FROM documents
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

- `embedding <=> $1::vector` — cosine **distance** between each row's stored vector and your
  query vector (0 = identical direction, 2 = opposite).
- `1 - (...)` — flips distance into similarity (1 = identical, -1 = opposite), which is more
  intuitive to read in a response.
- `WHERE embedding IS NOT NULL` — skip documents that haven't been embedded yet.
- `ORDER BY embedding <=> $1::vector` — sort by distance ascending (closest/most similar first).
- `LIMIT 5` — only return the top 5 matches.

---

## 13. RAG Example

```bash
curl -X POST http://localhost:5000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Node.js?"}'
```

Flow (implemented in `documentController.askQuestion`):

```
question
   ↓ embedText()
query vector
   ↓ searchSimilar()  (pgvector cosine search)
top 3 documents
   ↓ build a prompt: "Answer using ONLY this context: ..."
   ↓ chatModel.invoke(prompt)   (LangChain → OpenAI gpt-4o-mini)
answer
```

Response:

```json
{
  "question": "What is Node.js?",
  "answer": "Node.js is a JavaScript runtime built on Chrome's V8 engine...",
  "sources": [{ "id": 1, "title": "Node.js Basics", "similarity": 0.87 }]
}
```

---

## 14. Useful PostgreSQL Queries

Inspect a document's embedding (truncated, since it's 1536 numbers):

```sql
SELECT id, title, LEFT(embedding::text, 80) FROM documents;
```

Count how many documents still need embedding:

```sql
SELECT count(*) FROM documents WHERE embedding IS NULL;
```

Manually run a similarity search against a stored document's own vector (sanity check — should
return that same document first with similarity ~1.0):

```sql
SELECT id, title, 1 - (embedding <=> (SELECT embedding FROM documents WHERE id = 1)) AS similarity
FROM documents
ORDER BY similarity DESC;
```

---

## 15. Common Errors

| Error | Cause | Fix |
|---|---|---|
| `DATABASE_URL is not set` | `.env` missing/not loaded | `cp .env.example .env` and fill it in |
| `OPENAI_API_KEY is not set` | Same as above | Add a valid key to `.env` |
| `503 Database is unreachable` | Postgres container isn't running | `docker compose up postgres` |
| `400 Invalid ID format` | Non-numeric `:id` in URL | Use a real integer document ID |
| Embedding call fails (401/429 from OpenAI) | Bad key, no quota, or rate limit | Check your OpenAI account/billing |
| `404 Document not found` | Wrong ID or already deleted | `GET /api/documents` to list valid IDs |
| Vector search returns `[]` | No documents embedded yet | `POST /api/documents/:id/embed` first |

---

## 16. Stopping/Restarting Docker

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers, DELETE data (fresh init.sql run)
docker compose up            # restart
docker compose up --build    # rebuild the api image (after code changes) and start
```

## 17. Inspecting PostgreSQL Directly

```bash
docker compose exec postgres psql -U postgres -d docsdb
```

Then inside `psql`:

```sql
\dt                 -- list tables
\d documents        -- describe the documents table
\dx                 -- list installed extensions (confirm "vector" is there)
SELECT * FROM documents;
```

## 18. Testing APIs with curl/Postman

- Import the requests from sections 10–13 above into Postman (or just run the `curl` commands
  directly).
- Suggested order: create 2-3 documents → embed each one → try `/api/search` → try `/api/ask`.

---

## Learning Path: How This Project Was Built, Phase by Phase

Each phase below tells you **what** was added, **why**, **what happens internally**, **which
files**, and **how to test it** — read this section top to bottom to understand the project the
way it was designed, rather than jumping straight to the finished code above.

### Phase 1 — Node.js + Express
**What:** A bare Express app (`src/app.js`, `src/server.js`) with one `/health` route.
**Why:** Confirm the server boots and Express is wired up before adding any database or AI
complexity.
**Internals:** `express()` creates an app; `app.listen(PORT)` starts an HTTP server on top of
Node's built-in `http` module.
**Test:** `npm run dev` then `curl http://localhost:5000/health` → `{"status":"ok"}`.

### Phase 2 — PostgreSQL + Docker
**What:** `docker-compose.yml`'s `postgres` service, using the `pgvector/pgvector:pg16` image
(regular Postgres + the extension pre-installed).
**Why:** Get a real database running locally without installing Postgres on your machine.
**Internals:** Docker Compose creates a container, exposes port 5432, and persists data in the
`pgdata` named volume so data survives container restarts (but not `docker compose down -v`).
**Test:** `docker compose up postgres` then `docker compose exec postgres psql -U postgres -d docsdb -c "SELECT 1;"`.

### Phase 3 — Basic CRUD
**What:** `src/config/db.js` (connection pool), `documentController.js`'s five CRUD functions,
`documentRoutes.js`.
**Why:** Get plain data in and out of Postgres before introducing vectors — CRUD is the
foundation everything else builds on.
**Internals:** Each handler runs one parameterized SQL query via `pool.query(sql, [params])`.
Parameterized queries (`$1`, `$2`) prevent SQL injection — never string-concatenate user input
into SQL.
**Test:** Run the `curl` commands in section 10 above, in order: create → get all → get one →
update → delete.

### Phase 4 — Install/enable pgvector
**What:** `db/init.sql`'s `CREATE EXTENSION IF NOT EXISTS vector;` and the `embedding
vector(1536)` column.
**Why:** Without this, Postgres has no `vector` type at all — the extension has to be enabled
per-database before you can use it.
**Internals:** Postgres extensions are compiled C code loaded into the server; `pgvector/pgvector`
Docker images ship it pre-built so `CREATE EXTENSION` just has to enable it, not compile it.
**Test:** `docker compose exec postgres psql -U postgres -d docsdb -c "\dx"` → should list `vector`.

### Phase 5 — Store embeddings
**What:** `src/services/embeddingService.js` (calls OpenAI via LangChain) and
`vectorSearchService.storeEmbedding()`, wired together in `documentController.embedDocument`.
**Why:** Separate "how do I get a vector" (embeddingService) from "how do I save a vector"
(vectorSearchService) so each file has one clear job.
**Internals:** `embedQuery(text)` sends an HTTP request to OpenAI and gets back an array of 1536
floats; `storeEmbedding` converts that array to the text format pgvector expects (`"[0.1,0.2,...]"`)
and runs an `UPDATE ... SET embedding = $1::vector`.
**Test:** Section 11 above — embed a document, then confirm with
`SELECT id, LEFT(embedding::text, 40) FROM documents WHERE id = 1;` in `psql`.

### Phase 6 — Vector similarity search
**What:** `vectorSearchService.searchSimilar()` and the `GET /api/search` route.
**Why:** The actual point of using pgvector — being able to ask "what's related to this?"
**Internals:** See the full breakdown of the `<=>` query in section 12 above.
**Test:** Embed 2-3 documents on different topics, then run section 12's `curl` command and
confirm the most topically relevant document comes back first with the highest `similarity`.

### Phase 7 — LangChain integration
**What:** Formalized in `embeddingService.js` (`OpenAIEmbeddings`) — this was actually
introduced in Phase 5, since embeddings *are* the first LangChain integration point.
**Why:** Isolating LangChain calls to one file per concern (embeddings vs. chat) means swapping
providers later never touches route/controller code.
**Test:** Same as Phase 5 — if it works, LangChain is correctly wired.

### Phase 8 — Simple RAG
**What:** `documentController.askQuestion` and `POST /api/ask`, using `ChatOpenAI` from
`@langchain/openai`.
**Why:** Demonstrate the full point of storing embeddings: answering questions grounded in your
own documents instead of the model's general knowledge.
**Internals:** See the full flow breakdown in section 13 above. The prompt explicitly instructs
the model to answer only from the provided context, which reduces (but doesn't eliminate)
hallucination.
**Test:** Section 13's `curl` command, after embedding at least one relevant document.

### Phase 9 — Dockerize everything
**What:** `Dockerfile` (Node image) + the `api` service in `docker-compose.yml`.
**Why:** Make the whole stack reproducible with one command on any machine.
**Internals:** The Dockerfile copies `package.json` and installs dependencies *before* copying
source code, so Docker's layer cache skips `npm install` on rebuilds unless dependencies
actually changed — much faster iteration.
**Test:** `docker compose up --build`, then re-run the health check and a couple of CRUD calls
against `http://localhost:5000`.

### Phase 10 — Testing with Postman/curl
**What:** No new code — just exercising the whole API end-to-end.
**Why:** Confirm the full RAG loop works: create → embed → search → ask.
**Test:** Run through sections 10–13 in order against the Dockerized stack.

---

## Project Structure

```
project/
├── src/
│   ├── config/db.js                 # PostgreSQL connection pool
│   ├── controllers/documentController.js  # CRUD + embed + search + ask handlers
│   ├── routes/documentRoutes.js     # URL → handler mapping
│   ├── services/
│   │   ├── embeddingService.js      # Text → vector (LangChain + OpenAI)
│   │   └── vectorSearchService.js   # Store/search vectors in Postgres
│   ├── app.js                       # Express app + error handling
│   └── server.js                    # Entry point
├── db/init.sql                      # Enables pgvector, creates documents table
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
└── .gitignore
```
