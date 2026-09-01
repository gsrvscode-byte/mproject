require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("redis");
const amqp = require("amqplib");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

const PORT = process.env.APP_PORT || 3000;

// ---------- Postgres ----------
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || "postgres",
  port: Number(process.env.POSTGRES_PORT_INTERNAL) || 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

// ---------- Redis ----------
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || "redis"}:${process.env.REDIS_PORT_INTERNAL || 6379}`,
});
redisClient.on("error", (err) => console.error("Redis Client Error", err));

// ---------- RabbitMQ ----------
const RABBIT_URL = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST || "rabbitmq"}:${process.env.RABBITMQ_PORT_INTERNAL || 5672}`;
const REGISTER_QUEUE = "user_registered";

async function publishToQueue(queue, payload) {
  const connection = await amqp.connect(RABBIT_URL);
  const channel = await connection.createChannel();
  await channel.assertQueue(queue, { durable: true });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
  await channel.close();
  await connection.close();
}

async function initDb() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      visited_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function connectServices() {
  await redisClient.connect();
  console.log("Connected to Redis");
  await initDb();
  console.log("Postgres tables ready");
}

app.get("/", (req, res) => {
  res.json({
    message: "Node app is running",
    endpoints: [
      "GET /health",
      "GET /pg",
      "POST /redis",
      "GET /redis",
      "GET /redis/:key",
      "PUT /redis/:key",
      "DELETE /redis/:key",
      "GET /rabbitmq",
      "POST /register",
    ],
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Test Postgres: create a table if needed, insert a row, read it back
app.get("/pg", async (req, res) => {
  try {
    await pgPool.query("INSERT INTO visits DEFAULT VALUES");
    const { rows } = await pgPool.query(
      "SELECT COUNT(*)::int AS total FROM visits"
    );
    res.json({ service: "postgres", total_visits: rows[0].total });
  } catch (err) {
    res.status(500).json({ service: "postgres", error: err.message });
  }
});

// ---------- Redis: full CRUD ----------

// CREATE - fails with 409 if the key already exists
app.post("/redis", async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || value === undefined) {
    return res.status(400).json({ error: "'key' and 'value' are required" });
  }
  try {
    const wasSet = await redisClient.set(key, JSON.stringify(value), {
      NX: true,
    });
    if (!wasSet) {
      return res
        .status(409)
        .json({ error: `Key '${key}' already exists. Use PUT to update.` });
    }
    res.status(201).json({ key, value });
  } catch (err) {
    res.status(500).json({ service: "redis", error: err.message });
  }
});

// READ (list) - list all keys with their values
app.get("/redis", async (req, res) => {
  try {
    const keys = await redisClient.keys("*");
    const entries = await Promise.all(
      keys.map(async (k) => {
        const raw = await redisClient.get(k);
        return [k, safeParse(raw)];
      })
    );
    res.json({ service: "redis", data: Object.fromEntries(entries) });
  } catch (err) {
    res.status(500).json({ service: "redis", error: err.message });
  }
});

// READ (single)
app.get("/redis/:key", async (req, res) => {
  try {
    const raw = await redisClient.get(req.params.key);
    if (raw === null) {
      return res.status(404).json({ error: `Key '${req.params.key}' not found` });
    }
    res.json({ key: req.params.key, value: safeParse(raw) });
  } catch (err) {
    res.status(500).json({ service: "redis", error: err.message });
  }
});

// UPDATE - only succeeds if key already exists
app.put("/redis/:key", async (req, res) => {
  const { value } = req.body || {};
  if (value === undefined) {
    return res.status(400).json({ error: "'value' is required" });
  }
  try {
    const exists = await redisClient.exists(req.params.key);
    if (!exists) {
      return res
        .status(404)
        .json({ error: `Key '${req.params.key}' not found. Use POST to create.` });
    }
    await redisClient.set(req.params.key, JSON.stringify(value));
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ service: "redis", error: err.message });
  }
});

// DELETE
app.delete("/redis/:key", async (req, res) => {
  try {
    const deleted = await redisClient.del(req.params.key);
    if (!deleted) {
      return res.status(404).json({ error: `Key '${req.params.key}' not found` });
    }
    res.json({ deleted: req.params.key });
  } catch (err) {
    res.status(500).json({ service: "redis", error: err.message });
  }
});

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Test RabbitMQ: publish a message to a queue and confirm
app.get("/rabbitmq", async (req, res) => {
  try {
    const message = { event: "visit", timestamp: new Date().toISOString() };
    await publishToQueue("app_events", message);
    res.json({ service: "rabbitmq", published_to: "app_events", message });
  } catch (err) {
    res.status(500).json({ service: "rabbitmq", error: err.message });
  }
});

// ---------- Registration: Postgres + RabbitMQ ----------
// Saves the user, then publishes an event to RabbitMQ. A separate
// worker (worker.js) consumes that event and sends a welcome email
// via the dummy MailHog SMTP server.
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "'name', 'email', and 'password' are required" });
  }

  try {
    const existing = await pgPool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pgPool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );
    const user = rows[0];

    await publishToQueue(REGISTER_QUEUE, {
      id: user.id,
      name: user.name,
      email: user.email,
    });

    res.status(201).json({
      message: "User registered. Welcome email queued.",
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connectServices()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`App listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start app:", err);
    process.exit(1);
  });
