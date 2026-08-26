// src/app.js
//
// Configures the Express app itself (middleware + routes). Kept separate
// from server.js so the app can be imported by tests later without
// actually starting a server.

const express = require("express");
const documentRoutes = require("./routes/documentRoutes");

const app = express();

// Parse incoming JSON request bodies into req.body
app.use(express.json());

// Simple health check — useful for confirming the API + DB are up
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", documentRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ---------- Centralized error handler ----------
// Every controller calls next(err) on failure instead of handling errors
// inline. They all land here, so we only have ONE place that decides how
// errors turn into HTTP responses.
app.use((err, req, res, next) => {
  console.error(err);

  // Missing OpenAI key (thrown at import time in embeddingService.js)
  if (err.message && err.message.includes("OPENAI_API_KEY")) {
    return res.status(500).json({ error: "Server misconfiguration: OpenAI API key is missing" });
  }

  // PostgreSQL connection refused / DB unreachable
  if (err.code === "ECONNREFUSED") {
    return res.status(503).json({ error: "Database is unreachable" });
  }

  // Invalid input type for an integer column/parameter (e.g. bad :id)
  if (err.code === "22P02") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  res.status(500).json({ error: "Internal server error", details: err.message });
});

module.exports = app;
