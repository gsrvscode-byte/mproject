// src/config/db.js
//
// This file creates ONE shared "pool" of PostgreSQL connections that the
// rest of the app reuses. A Pool is better than opening a new connection
// per request because opening a TCP connection to Postgres is relatively
// slow — the pool keeps a handful of connections open and hands them out
// as needed.

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  // Fail loudly and immediately at startup rather than failing later
  // with a confusing error the first time a query runs.
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log a clear message if Postgres becomes unreachable after startup
// (e.g. the container was stopped), instead of letting the process
// crash with a raw stack trace.
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error on idle client:", err.message);
});

module.exports = pool;
