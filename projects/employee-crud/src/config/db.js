// src/config/db.js
//
// One shared pool of PostgreSQL connections, reused across every request.

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error on idle client:", err.message);
});

module.exports = pool;
