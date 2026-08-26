-- ============================================================
-- db/init.sql
--
-- This file runs automatically the FIRST time the Postgres
-- container starts with an empty data volume (Docker's
-- postgres image auto-runs everything in
-- /docker-entrypoint-initdb.d/ on first boot).
-- ============================================================

-- 1. Enable the pgvector extension.
--
-- WHY THIS IS REQUIRED:
-- Plain PostgreSQL has no idea what a "vector" is or how to compare
-- two vectors for similarity. pgvector is an extension (a plugin) that
-- adds:
--   - a new column type: vector(N)
--   - similarity operators: <-> (Euclidean), <#> (inner product),
--     <=> (cosine distance)
--   - the ability to index vector columns (HNSW / IVFFlat) for fast
--     nearest-neighbor search
-- Without this extension, we could still store embeddings as plain
-- arrays of numbers, but we could not efficiently ask "which rows are
-- most similar to this vector?" directly in SQL.
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the documents table.
--
-- embedding is vector(1536) because we are using OpenAI's
-- "text-embedding-3-small" model, which always returns a list of
-- 1536 numbers per piece of text. The dimension size must match
-- exactly whatever embedding model you use — if you switch models,
-- you must also change this number (and re-embed everything).
CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(1536),               -- NULL until /embed is called
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes.
--
-- Do we need an HNSW or IVFFlat vector index for this project? NO.
--
-- Those indexes exist to speed up similarity search when you have
-- hundreds of thousands (or millions) of rows, because without an
-- index, pgvector has to compare your query vector against EVERY row
-- (a "sequential scan"). For a learning project with a handful to a
-- few thousand documents, a sequential scan is already fast (a few
-- milliseconds) — an index would only add complexity (index build
-- time, tuning parameters like `m`/`ef_construction` for HNSW or
-- `lists` for IVFFlat, and approximate rather than exact results)
-- with no real benefit at this scale.
--
-- If you later grow this into a real project with a large document
-- set, you'd add something like:
--   CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
-- but it is intentionally left out here so the search behaves exactly
-- like the SQL you can read and reason about.

-- A normal B-tree index on title is just a nice-to-have for lookups,
-- not required for the project to work.
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents (title);
